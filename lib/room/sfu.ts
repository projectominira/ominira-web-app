import * as api from "@/lib/room/api";
import type { SessionDescription } from "@/lib/room/types";

// Room audio through Cloudflare Realtime (spec §8.3, §8.4, §8.8): each member
// holds one RTCPeerConnection, to Cloudflare, never to another member. A
// speaker publishes their mic once (the first mic-on) and presence carries the
// Cloudflare session it's on; everyone else pulls it from there. Nobody has to
// agree on who calls whom: each member only follows presence.
//
// - Every change is one call to /api/rooms/{id}/audio that answers or fails,
//   run one at a time (Cloudflare wants a renegotiation done before the next).
// - Muting is replaceTrack: no renegotiation, no call.
// - A connection that fails, or stays disconnected past a grace, is rebuilt
//   whole: a new session, the mic published again (a new id in presence), and
//   every pull redone. A failed call rebuilds too, backing off.
// - A pull Cloudflare refuses (the speaker is mid-rebuild, their presence
//   still names the old session) is only asked again: rebuilding for it would
//   give our own mic a new session too, and every listener would re-pull us.

const DISCONNECTED_GRACE_MS = 4_000;
/** A negotiated connection not up by then is rebuilt. */
const CONNECT_TIMEOUT_MS = 12_000;
/** Rebuilds after failures back off along this. */
const RETRY_MS = [1_000, 2_000, 5_000, 10_000];
/** A pull Cloudflare refused (the speaker just rebuilt) is tried again. */
const PULL_RETRY_MS = 3_000;
/** Opus mono speech (spec §8.5). */
const MAX_BITRATE = 32_000;

/** Per voice: `reconnecting` is spec §10's speaker dropped. */
export type AudioHealth = "connecting" | "connected" | "reconnecting";

/** The dev overlay's numbers for the one connection (spec §8.10). */
export type AudioStats = {
  state: RTCPeerConnectionState;
  rttMs: number | null;
  jitterMs: number | null;
  packetsLost: number;
  /** Through TURN. */
  relayed: boolean;
  /** Voices arriving. */
  streams: number;
};

export type SfuOptions = {
  roomId: string;
  iceServers: RTCIceServer[];
  /** Dev: TURN only, to test the relay (spec §8.4). */
  forceRelay: boolean;
  /** The mic is published on this Cloudflare session (again, after a rebuild): presence says so. */
  onPublished: (session: string) => void;
  /** A member's voice, by their room sessionId. */
  onStream: (sessionId: string, stream: MediaStream) => void;
  onDrop: (sessionId: string) => void;
  /** Every voice wanted, by room sessionId. */
  onHealth: (health: Map<string, AudioHealth>) => void;
};

export type Sfu = {
  /** From the first mic-on: publish the mic, and keep it published. */
  publish(): void;
  /** Mic on (the track) or off (null). */
  setTrack(track: MediaStreamTrack | null): void;
  /** Pull exactly these: room sessionId → the Cloudflare session their mic is on. */
  setPulls(pulls: ReadonlyMap<string, string>): void;
  /** Back from a hidden tab: rebuild now if the connection broke meanwhile. */
  check(): void;
  stats(): Promise<AudioStats>;
  /** Rebuilds so far, for the leave beacon. */
  readonly reconnects: number;
  close(): void;
};

type Pulled = { publisher: string; mid: string };

export function createSfu(options: SfuOptions): Sfu {
  const { roomId } = options;
  let pc = createPc();
  /** Bumped by every rebuild; work begun before one stops at its next step. */
  let generation = 0;
  let owned: { session: string; token: string } | null = null;
  let publishing = false;
  let micSender: RTCRtpSender | null = null;
  let track: MediaStreamTrack | null = null;
  let wanted: ReadonlyMap<string, string> = new Map();
  const pulled = new Map<string, Pulled>();
  const byMid = new Map<string, string>();
  const arrived = new Set<string>();
  let rebuilding = false;
  let failures = 0;
  let reconnects = 0;
  let closed = false;
  let queue: Promise<void> = Promise.resolve();
  let queued = false;
  /** The connection's grace or connect timeout. */
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** The backed-off rebuild after a failed call; the connection coming up doesn't cancel it. */
  let retry: ReturnType<typeof setTimeout> | null = null;

  function createPc(): RTCPeerConnection {
    const next = new RTCPeerConnection({
      iceServers: options.iceServers,
      bundlePolicy: "max-bundle",
      iceTransportPolicy: options.forceRelay ? "relay" : "all",
    });
    next.ontrack = ({ transceiver, track: remote }) => {
      const sessionId = transceiver.mid ? byMid.get(transceiver.mid) : undefined;
      if (!sessionId || next !== pc) return;
      arrived.add(sessionId);
      options.onStream(sessionId, new MediaStream([remote]));
      report();
    };
    next.onconnectionstatechange = () => {
      if (next !== pc || closed) return;
      const state = next.connectionState;
      if (state === "connected") {
        rebuilding = false;
        failures = 0;
        setTimer(null);
      } else if (state === "failed") rebuild();
      else if (state === "disconnected") setTimer(DISCONNECTED_GRACE_MS, rebuild);
      report();
    };
    return next;
  }

  function setTimer(ms: number | null, then?: () => void) {
    if (timer) clearTimeout(timer);
    timer = ms === null || !then ? null : setTimeout(() => ((timer = null), then()), ms);
  }

  function report() {
    const health = new Map<string, AudioHealth>();
    const up = pc.connectionState === "connected";
    for (const sessionId of wanted.keys()) {
      health.set(sessionId, rebuilding ? "reconnecting" : up && arrived.has(sessionId) ? "connected" : "connecting");
    }
    options.onHealth(health);
  }

  /** One sync pass after whatever is running; however many changes arrive meanwhile. */
  function kick() {
    if (closed || queued) return;
    queued = true;
    queue = queue.then(() => {
      queued = false;
      return sync(generation);
    });
  }

  async function call(body: Exclude<api.RoomAudioOp, { op: "session" }>) {
    const result = await api.roomAudio(roomId, body);
    if (result.errorCode) throw new Error(`${body.op}: ${result.errorCode} ${result.errorDescription ?? ""}`);
    return result;
  }

  /** Make the connection match `publishing` and `wanted`. */
  async function sync(g: number): Promise<void> {
    const stale = () => closed || g !== generation;
    try {
      if (!publishing && wanted.size === 0 && pulled.size === 0) return;
      owned ??= await api.roomAudio(roomId, { op: "session" });
      if (stale()) return;
      const own = owned;

      if (publishing && !micSender) {
        const transceiver = pc.addTransceiver(track ?? "audio", { direction: "sendonly" });
        micSender = transceiver.sender;
        await pc.setLocalDescription(await pc.createOffer());
        const result = await call({ op: "push", ...own, offer: local(pc), mid: transceiver.mid! });
        if (stale()) return;
        await pc.setRemoteDescription(result.sessionDescription!);
        await capBitrate(transceiver.sender);
        if (stale()) return;
        options.onPublished(own.session);
        watchConnect(g);
      }

      const gone = [...pulled].filter(([sessionId, p]) => wanted.get(sessionId) !== p.publisher);
      if (gone.length) {
        for (const [sessionId, p] of gone) {
          pc.getTransceivers().find((t) => t.mid === p.mid)?.stop();
          drop(sessionId);
        }
        await pc.setLocalDescription(await pc.createOffer());
        const result = await call({ op: "close", ...own, mids: gone.map(([, p]) => p.mid), offer: local(pc) });
        if (stale()) return;
        await pc.setRemoteDescription(result.sessionDescription!);
      }

      const add = [...wanted].filter(([sessionId]) => !pulled.has(sessionId));
      if (add.length) {
        const result = await api.roomAudio(roomId, { op: "pull", ...own, publishers: add.map(([, publisher]) => publisher) });
        if (stale()) return;
        // Failed whole, before looking at a track: our session is the trouble.
        if (result.errorCode && !result.tracks?.length) throw new Error(`pull: ${result.errorCode} ${result.errorDescription ?? ""}`);
        let refused = false;
        add.forEach(([sessionId, publisher], i) => {
          // In the order asked for.
          const t = result.tracks?.[i];
          if (!t?.mid || t.errorCode || (t.sessionId && t.sessionId !== publisher)) refused = true;
          else {
            pulled.set(sessionId, { publisher, mid: t.mid });
            byMid.set(t.mid, sessionId);
          }
        });
        if (result.requiresImmediateRenegotiation && result.sessionDescription) {
          await pc.setRemoteDescription(result.sessionDescription);
          await pc.setLocalDescription(await pc.createAnswer());
          await call({ op: "answer", ...own, answer: local(pc) });
          if (stale()) return;
          watchConnect(g);
        }
        if (refused) setTimeout(() => g === generation && kick(), PULL_RETRY_MS);
      }
      report();
    } catch (err) {
      if (stale()) return;
      console.warn("[room] audio", err);
      const wait = RETRY_MS[Math.min(failures++, RETRY_MS.length - 1)];
      rebuilding = true;
      report();
      if (retry) clearTimeout(retry);
      retry = setTimeout(() => ((retry = null), g === generation && rebuild()), wait);
    }
  }

  /** A negotiated connection that doesn't come up is rebuilt. */
  function watchConnect(g: number) {
    if (pc.connectionState === "connected" || timer) return;
    setTimer(CONNECT_TIMEOUT_MS, () => g === generation && pc.connectionState !== "connected" && rebuild());
  }

  function drop(sessionId: string) {
    const p = pulled.get(sessionId);
    if (p) byMid.delete(p.mid);
    pulled.delete(sessionId);
    arrived.delete(sessionId);
    options.onDrop(sessionId);
  }

  /** Everything again on a fresh connection and session. */
  function rebuild() {
    if (closed) return;
    generation++;
    reconnects++;
    rebuilding = true;
    setTimer(null);
    if (retry) clearTimeout(retry);
    retry = null;
    pc.close();
    for (const sessionId of [...pulled.keys()]) drop(sessionId);
    owned = null;
    micSender = null;
    pc = createPc();
    report();
    kick();
  }

  return {
    publish() {
      if (publishing) return;
      publishing = true;
      kick();
    },

    setTrack(next) {
      track = next;
      if (micSender && micSender.track !== next) void micSender.replaceTrack(next).catch(() => {});
    },

    setPulls(next) {
      wanted = next;
      report();
      kick();
    },

    check() {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") rebuild();
      else kick();
    },

    async stats() {
      const all = await pc.getStats();
      let pair: RTCIceCandidatePairStats | undefined;
      let jitter: number | null = null;
      let packetsLost = 0;
      all.forEach((r) => {
        if (r.type === "transport" && r.selectedCandidatePairId) pair = all.get(r.selectedCandidatePairId);
        if (r.type === "inbound-rtp" && r.kind === "audio") {
          jitter = Math.max(jitter ?? 0, r.jitter ?? 0);
          packetsLost += r.packetsLost ?? 0;
        }
      });
      const rtt = pair?.currentRoundTripTime;
      return {
        state: pc.connectionState,
        rttMs: rtt === undefined ? null : Math.round(rtt * 1000),
        jitterMs: jitter === null ? null : Math.round(jitter * 1000),
        packetsLost,
        relayed: pair ? all.get(pair.localCandidateId)?.candidateType === "relay" : false,
        streams: arrived.size,
      };
    },

    get reconnects() {
      return reconnects;
    },

    close() {
      if (closed) return;
      closed = true;
      setTimer(null);
      if (retry) clearTimeout(retry);
      pc.close();
    },
  };
}

function local(pc: RTCPeerConnection): SessionDescription {
  const { type, sdp } = pc.localDescription!;
  return { type: type as SessionDescription["type"], sdp };
}

async function capBitrate(sender: RTCRtpSender): Promise<void> {
  const params = sender.getParameters();
  const encoding = params.encodings?.[0];
  if (!encoding || encoding.maxBitrate === MAX_BITRATE) return;
  encoding.maxBitrate = MAX_BITRATE;
  await sender.setParameters(params).catch(() => {});
}

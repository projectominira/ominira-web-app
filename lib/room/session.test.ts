import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { RoomChannel } from "./channel";
import type { RoomPresence } from "./events";
import { selectRoster } from "./presence";
import { RoomSession, type SessionDeps } from "./session";
import type { RoomJoinPayload } from "./types";

// RoomSession's core in Node (spec §8.10): several sessions on a fake
// Realtime hub that shuffles, duplicates, delays and drops presence syncs
// and broadcasts, with a fake audio connection, mic and playback. However the
// events arrive, every session ends up pulling exactly the published mics of
// the others, and publishing what it should.

/** Small seeded PRNG, so a failing seed can be replayed. */
function prng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type FakeChannel = {
  readerId: string;
  tracked: RoomPresence | null;
  onRoster: (entries: RoomPresence[]) => void;
  handlers: Map<string, ((payload: never) => void)[]>;
  closed: boolean;
};

function createHub(random: () => number) {
  const channels = new Set<FakeChannel>();
  const state = () => [...channels].flatMap((c) => (c.tracked ? [c.tracked] : []));
  const later = (fn: () => void) => setTimeout(fn, Math.floor(random() * 25));

  /** A sync with the current full state to everyone: maybe dropped,
   * maybe twice, entries shuffled, possibly overtaken by a later one. */
  function chaoticSync() {
    const snapshot = state();
    for (const c of channels) {
      if (random() < 0.25) continue;
      const times = random() < 0.25 ? 2 : 1;
      for (let i = 0; i < times; i++) {
        const entries = [...snapshot].sort(() => random() - 0.5);
        if (random() < 0.2 && entries.length) entries.push(entries[0]);
        later(() => !c.closed && c.onRoster(entries));
      }
    }
  }

  const open: SessionDeps["openRoomChannel"] = ({ readerId, onRoster, onStatus }) => {
    const c: FakeChannel = { readerId, tracked: null, onRoster, handlers: new Map(), closed: false };
    channels.add(c);
    onStatus("connecting");
    later(() => !c.closed && onStatus("live"));
    const channel: RoomChannel = {
      send(event, payload) {
        for (const other of channels) {
          if (other === c) continue;
          const copies = random() < 0.25 ? 2 : 1;
          for (let i = 0; i < copies; i++) later(() => !other.closed && other.handlers.get(event)?.forEach((h) => h(payload as never)));
        }
        return true;
      },
      on(event, handler) {
        c.handlers.set(event, [...(c.handlers.get(event) ?? []), handler as never]);
        return () => {};
      },
      track(presence) {
        c.tracked = presence;
        chaoticSync();
      },
      readStatus: async () => "live",
      heartbeat: async () => true,
      async close() {
        c.closed = true;
        channels.delete(c);
        chaoticSync();
      },
    };
    return channel;
  };

  return {
    open,
    /** The true state, delivered to everyone in order: what Realtime converges to. */
    async settle() {
      await wait(60);
      for (const c of channels) c.onRoster(state());
      await wait(20);
    },
    roster: () => selectRoster(state()),
  };
}

type FakeSfu = { published: boolean; pulls: string[]; track: unknown; closed: boolean };

function fakeDeps(hub: ReturnType<typeof createHub>, sfus: FakeSfu[]): SessionDeps {
  const payload = (roomId: string, readerId: string): RoomJoinPayload => ({
    room: {
      id: roomId,
      materialId: "book",
      title: "Room",
      bookTitle: "Book",
      bookAuthor: "Author",
      bookSlug: "book",
      startedBy: "r0",
      startedAt: new Date().toISOString(),
      maxMembers: 25,
      group: null,
    },
    isModerator: readerId === "r0",
    me: { name: readerId, avatar: { color: null, url: null } },
    moderatorIds: ["r0"],
    iceServers: [],
    supabase: { url: "", key: "" },
  });
  return {
    api: {
      startRoom: async () => payload("room", "r0"),
      joinRoom: async () => payload("room", "?"),
      leaveRoom: async () => {},
      leaveRoomOnUnload: () => {},
      endRoom: async () => {},
    },
    openRoomChannel: hub.open,
    createSfu: (options) => {
      const sfu: FakeSfu = { published: false, pulls: [], track: null, closed: false };
      sfus.push(sfu);
      return {
        publish() {
          if (sfu.published) return;
          sfu.published = true;
          queueMicrotask(() => options.onPublished(`cf-${Math.random()}`));
        },
        setTrack: (track) => void (sfu.track = track),
        setPulls(pulls) {
          sfu.pulls = [...pulls.keys()];
          options.onHealth(new Map(sfu.pulls.map((id) => [id, "connected"])));
        },
        check() {},
        stats: async () => ({ state: "connected", rttMs: 1, jitterMs: 1, packetsLost: 0, relayed: false, streams: 0 }),
        reconnects: 0,
        close: () => void (sfu.closed = true),
      };
    },
    createMic: ({ onChange }) => {
      let state: "off" | "on" = "off";
      const track = { id: Math.random() };
      return {
        get state() {
          return state;
        },
        on: async () => {
          state = "on";
          onChange("on", track as never);
        },
        off: () => {
          state = "off";
          onChange("off", null);
        },
        close: () => {},
      };
    },
    createPlayback: () => ({
      add() {},
      remove() {},
      setLocal() {},
      levels: () => new Map(),
      resume: async () => {},
      suspended: false,
      close() {},
    }),
  };
}

beforeAll(() => {
  // The session listens for visibility and pagehide; Node has neither.
  Object.assign(globalThis, {
    window: new EventTarget(),
    document: Object.assign(new EventTarget(), { visibilityState: "visible" }),
  });
});

afterAll(() => {
  Object.assign(globalThis, { window: undefined, document: undefined });
});

describe("RoomSession on a chaotic channel", () => {
  for (const seed of [1, 7, 42, 99, 2026]) {
    test(`pulls every published mic (seed ${seed})`, async () => {
      const random = prng(seed);
      const hub = createHub(random);
      const sfus: FakeSfu[][] = [];
      const sessions: RoomSession[] = [];
      const open = (readerId: string) => {
        const created: FakeSfu[] = [];
        sfus.push(created);
        const session = new RoomSession(readerId, async () => "token", {} as AudioContext, fakeDeps(hub, created));
        sessions.push(session);
        return session;
      };

      const [a, b, c, d, e] = ["r0", "r1", "r2", "r3", "r4"].map(open);
      await a.start("book");
      await Promise.all([b, c, d, e].map((s) => s.join("room")));
      await wait(10);
      await b.setMic(true);
      await c.setMic(true);
      c.setMic(false);
      d.raiseHand();
      await wait(15);
      await e.leave();
      const e2 = open("r4");
      await e2.join("room");
      const aTab2 = open("r0");
      await aTab2.join("room");
      await d.setMic(true);
      await hub.settle();

      let snapshots = sessions.map((s) => {
        let snap: Parameters<Parameters<RoomSession["subscribe"]>[0]>[0] = null;
        s.subscribe((x) => (snap = x))();
        return snap as Parameters<Parameters<RoomSession["subscribe"]>[0]>[0];
      });
      // The first tab of r0 yielded to the second; e left.
      expect(snapshots[0]?.elsewhere).toBe(true);
      expect(snapshots[4]).toBeNull();

      const roster = hub.roster();
      expect(roster.map((p) => p.readerId).sort()).toEqual(["r0", "r1", "r2", "r3", "r4"]);

      sessions.forEach((session, i) => {
        const snap = snapshots[i];
        if (!snap || snap.elsewhere) {
          // Gone or yielded: nothing left open.
          expect(sfus[i].filter((p) => !p.closed)).toEqual([]);
          return;
        }
        const me = roster.find((p) => p.sessionId === snap.sessionId)!;
        expect(me).toBeDefined();
        expect(snap.roster.map((p) => p.sessionId).sort()).toEqual(roster.map((p) => p.sessionId).sort());
        const [sfu, ...more] = sfus[i].filter((p) => !p.closed);
        expect(more).toEqual([]);
        const published = roster.filter((p) => p.audio !== null && p.sessionId !== me.sessionId);
        expect(sfu.pulls.sort()).toEqual(published.map((p) => p.sessionId).sort());
        // Published iff this session has had its mic on; the track only while it's on.
        expect(sfu.published).toBe(me.audio !== null);
        expect(sfu.track !== null).toBe(me.micOnAt !== null);
      });

      // b, c and d have had their mic on; a's tab and e2 haven't.
      expect(roster.filter((p) => p.audio === null).length).toBe(2);

      await Promise.all(sessions.map((s) => s.leave()));
      snapshots = [];
    });
  }
});

describe("Reading aloud", () => {
  test("narration replaces the mic while it plays, and its word reaches listeners", async () => {
    const hub = createHub(() => 0.5); // no drops or duplicates
    const sfus: FakeSfu[] = [];
    const a = new RoomSession("r0", async () => "token", {} as AudioContext, fakeDeps(hub, []));
    const b = new RoomSession("r1", async () => "token", {} as AudioContext, fakeDeps(hub, sfus));
    const latest = (s: RoomSession) => {
      let snap: Parameters<Parameters<RoomSession["subscribe"]>[0]>[0] = null;
      s.subscribe((x) => (snap = x))();
      return snap as Parameters<Parameters<RoomSession["subscribe"]>[0]>[0];
    };
    await a.start("book");
    await b.join("room");
    await b.setMic(true);
    await hub.settle();
    const sent = () => sfus.filter((p) => !p.closed).map((p) => p.track);
    const mic = sent()[0];
    expect(mic).toBeTruthy();

    const narration = { id: "narration" } as unknown as MediaStreamTrack;
    b.setNarration({ track: narration, voice: "en-ZA-LeahNeural", word: { passageId: "p1", index: 3 } });
    await wait(40);
    expect(sent()).toEqual([narration]);
    expect(latest(b)?.readingAloud).toBe(true);
    expect(latest(a)?.narration).toEqual({ readerId: "r1", passageId: "p1", index: 3 });
    // The room is told whose voice is reading.
    await hub.settle();
    expect(latest(a)?.roster.find((p) => p.readerId === "r1")?.readingAloud).toBe("en-ZA-LeahNeural");

    // Paused: the mic again, and the highlight clears.
    b.setNarration(null);
    await wait(40);
    expect(sent()).toEqual([mic]);
    expect(latest(b)?.readingAloud).toBe(false);
    expect(latest(a)?.narration).toBeNull();
    await hub.settle();
    expect(latest(a)?.roster.find((p) => p.readerId === "r1")?.readingAloud).toBeNull();

    // Mic off: narration isn't sent, nor its word.
    await b.setMic(false);
    b.setNarration({ track: narration, voice: "en-ZA-LeahNeural", word: { passageId: "p1", index: 4 } });
    await wait(40);
    expect(sent()).toEqual([null]);
    expect(latest(a)?.narration).toBeNull();

    await Promise.all([a.leave(), b.leave()]);
  });
});

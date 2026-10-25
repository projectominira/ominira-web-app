// Room audio out, and the levels speaking detection reads (spec §8.6, §8.7).
//
// Each remote stream plays through its own hidden <audio playsinline>
// (Chrome's echo cancellation covers media elements, not Web Audio output,
// so a speaker without headphones would otherwise hear an echo). The one
// AudioContext only taps each stream, and the local mic, into an analyser.
// The context is created and resumed in the join tap (room-store), and a
// refused play() or a suspended context shows "Tap to resume audio".

/** Each level reads back this far, a little past speaking.ts's 150 ms tick,
 * so every sample is measured: a short snapshot mostly lands in the gaps
 * between syllables and misses speech. */
const WINDOW_S = 0.16;
/** A level is the loudest stretch this long in the window: a syllable's
 * length, so pauses around it don't dilute it. */
const CHUNK_S = 0.02;

type Tap = { source: MediaStreamAudioSourceNode; analyser: AnalyserNode; sink: HTMLAudioElement | null };

export type Playback = {
  /** A remote session's stream: play it and measure it. Replaces any earlier one. */
  add(sessionId: string, stream: MediaStream): void;
  remove(sessionId: string): void;
  /** The local mic, measured only (never played back). */
  setLocal(sessionId: string, track: MediaStreamTrack | null): void;
  /** Per session, local included, for speaking.ts: the loudest 20 ms RMS
   * (0–1) since the last read. */
  levels(): Map<string, number>;
  /** In a tap: resume the context and retry refused sinks. */
  resume(): Promise<void>;
  readonly suspended: boolean;
  close(): void;
};

export function createPlayback(options: { context: AudioContext; onSuspended: (suspended: boolean) => void }): Playback {
  const { context } = options;
  const taps = new Map<string, Tap>();
  const refused = new Set<HTMLAudioElement>();
  // The smallest power of two covering the window (the analyser's limit is 32768).
  const fftSize = Math.min(32768, 2 ** Math.ceil(Math.log2(context.sampleRate * WINDOW_S)));
  const chunk = Math.round(context.sampleRate * CHUNK_S);
  const buffer = new Float32Array(fftSize);
  // Analysers have to reach the destination to be pulled in every browser; silently.
  const silent = context.createGain();
  silent.gain.value = 0;
  silent.connect(context.destination);
  let suspended = false;
  let closed = false;

  const report = () => {
    const next = !closed && (context.state !== "running" || refused.size > 0);
    if (next === suspended) return;
    suspended = next;
    options.onSuspended(next);
  };
  context.addEventListener("statechange", report);

  const play = (sink: HTMLAudioElement) =>
    sink.play().then(
      () => {
        refused.delete(sink);
        report();
      },
      () => {
        if (sink.srcObject) refused.add(sink);
        report();
      },
    );

  function tap(sessionId: string, stream: MediaStream, sink: HTMLAudioElement | null) {
    remove(sessionId);
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = fftSize;
    source.connect(analyser);
    analyser.connect(silent);
    taps.set(sessionId, { source, analyser, sink });
  }

  function remove(sessionId: string) {
    const held = taps.get(sessionId);
    if (!held) return;
    taps.delete(sessionId);
    held.source.disconnect();
    held.analyser.disconnect();
    if (held.sink) {
      refused.delete(held.sink);
      held.sink.pause();
      held.sink.srcObject = null;
    }
    report();
  }

  return {
    add(sessionId, stream) {
      if (closed) return;
      const sink = new Audio();
      sink.autoplay = true;
      sink.setAttribute("playsinline", "");
      sink.srcObject = stream;
      tap(sessionId, stream, sink);
      void play(sink);
    },

    remove,

    setLocal(sessionId, track) {
      if (closed) return;
      if (track) tap(sessionId, new MediaStream([track]), null);
      else remove(sessionId);
    },

    levels() {
      const levels = new Map<string, number>();
      for (const [sessionId, { analyser }] of taps) {
        analyser.getFloatTimeDomainData(buffer);
        let loudest = 0;
        for (let start = 0; start + chunk <= buffer.length; start += chunk) {
          let sum = 0;
          for (let i = start; i < start + chunk; i++) sum += buffer[i] * buffer[i];
          loudest = Math.max(loudest, sum / chunk);
        }
        levels.set(sessionId, Math.sqrt(loudest));
      }
      return levels;
    },

    async resume() {
      if (closed) return;
      await context.resume().catch(() => {});
      await Promise.all([...refused].map(play));
      report();
    },

    get suspended() {
      return suspended;
    },

    close() {
      if (closed) return;
      for (const sessionId of [...taps.keys()]) remove(sessionId);
      closed = true;
      context.removeEventListener("statechange", report);
      silent.disconnect();
      void context.close().catch(() => {});
    },
  };
}

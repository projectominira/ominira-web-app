// The narration as a MediaStreamTrack, so a reading room can send it to its
// listeners in place of the speaker's mic (lib/room/session.ts). NarrationEngine
// registers its one <audio> element; the first tap reroutes that element
// through a Web Audio graph that plays it as before and also feeds the track.
//
// createMediaElementSource is once per element and for good, so the graph has
// its own AudioContext that is never closed (the room's closes on leave, which
// would silence narration). It's built in the speaker's mic-on tap, so the
// browser lets it start; a later pause by the browser (iOS, backgrounding) is
// resumed on the next tap or key press.

let element: HTMLAudioElement | null = null;
let tap: { context: AudioContext; track: MediaStreamTrack } | null = null;

export function registerNarrationElement(el: HTMLAudioElement | null): void {
  element = el;
}

// 25ms of silence. iOS only lets an element play() outside a tap once it has
// played inside one — and on Listen the real clip is still synthesizing, so
// the tap plays this instead, letting the clip start by itself when it lands.
export const SILENT_SRC =
  "data:audio/wav;base64,UklGRuwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YcgAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";
let unlocked = false;

/** Call in a tap that starts playback. Once per page; a no-op while a clip is loaded. */
export function unlockNarration(): void {
  if (unlocked || !element || element.getAttribute("src")) return;
  unlocked = true;
  element.src = SILENT_SRC;
  element.play().catch(() => {
    unlocked = false;
  });
}

/** Call in a tap. Creates the track the first time; later calls return it. */
export function tapNarration(): MediaStreamTrack | null {
  if (tap) {
    void tap.context.resume().catch(() => {});
    return tap.track;
  }
  if (!element) return null;
  const context = new AudioContext();
  const source = context.createMediaElementSource(element);
  const destination = context.createMediaStreamDestination();
  source.connect(context.destination);
  source.connect(destination);
  const track = destination.stream.getAudioTracks()[0];
  track.contentHint = "speech";
  tap = { context, track };
  void context.resume().catch(() => {});
  const resume = () => {
    if (context.state !== "running") void context.resume().catch(() => {});
  };
  for (const type of ["pointerdown", "keydown"]) window.addEventListener(type, resume, { capture: true, passive: true });
  return track;
}

/** The track, if a tap has made one; never creates it. */
export function narrationTrack(): MediaStreamTrack | null {
  return tap?.track ?? null;
}

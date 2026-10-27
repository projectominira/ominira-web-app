// The room's one local mic track (spec §8.5). Asked for on the first mic-on,
// never at join. Off hands peers null (replaceTrack, zero packets) but keeps
// the track until the room closes, so on again is instant and never asks
// again: Safari, Firefox and Chrome's "Allow this time" all ask once more
// on the next getUserMedia after the last track has stopped. The OS mic
// indicator stays on while in the room, as on a call.
// Best practice (web.dev, permissions): say "Choose Allow" while the browser
// asks ("asking"), since a block is remembered and rejoining won't ask again;
// and when the reader allows it in settings, the mic comes on by itself.

import { setAudioSessionType } from "@/lib/room/audioSession"; // REVERT: remove with the two calls below

/** asking: the browser's permission prompt is up. */
export type MicState = "off" | "acquiring" | "asking" | "on" | "blocked";

const CONSTRAINTS: MediaStreamConstraints = {
  // autoGainControl off: it dipped speakers' volume now and then.
  // REVERT: set autoGainControl back to true.
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 },
};

export type Mic = {
  /** Resolves once on, or blocked (denied, or no mic). */
  on(): Promise<void>;
  off(): void;
  readonly state: MicState;
  close(): void;
};

type Options = {
  /** The track to send: live while on, null while off. */
  onChange: (state: MicState, track: MediaStreamTrack | null) => void;
  /** Blocked, then allowed in the browser's settings: turn it on. */
  onAllowed?: () => void;
  media?: Pick<MediaDevices, "getUserMedia" | "addEventListener" | "removeEventListener">;
  permissions?: Pick<Permissions, "query">;
};

export function createMic(options: Options): Mic {
  const media = options.media ?? (typeof navigator !== "undefined" ? navigator.mediaDevices : undefined);
  let state: MicState = "off";
  let track: MediaStreamTrack | null = null;
  let wanted = false;
  let closed = false;
  let acquiring: Promise<MediaStreamTrack | null> | null = null;
  // The site's mic permission, kept current; null where it can't be read.
  let permission: PermissionStatus | null = null;
  const onPermission = () => {
    if (state === "blocked" && permission?.state !== "denied") options.onAllowed?.();
  };
  const permissions = options.permissions ?? (typeof navigator !== "undefined" ? navigator.permissions : undefined);
  void permissions
    ?.query({ name: "microphone" as PermissionName })
    .then((status) => {
      if (closed) return;
      permission = status;
      status.addEventListener("change", onPermission);
    })
    .catch(() => {});

  const set = (next: MicState) => {
    state = next;
    options.onChange(state, state === "on" ? track : null);
  };

  // One getUserMedia at a time; a second caller waits on the same one.
  const acquire = () => {
    // No mediaDevices: an insecure page or an in-app browser without the mic.
    if (!media?.getUserMedia) return Promise.resolve(null);
    setAudioSessionType("play-and-record"); // REVERT: remove this line (iOS audio session)
    return (acquiring ??= media
      .getUserMedia(CONSTRAINTS)
      .then((stream) => {
        const next = stream.getAudioTracks()[0] ?? null;
        if (next) {
          next.contentHint = "speech";
          // Unplugged or revoked: get the default device again while on.
          next.addEventListener("ended", () => {
            if (track === next && state === "on") void replace();
          });
        }
        return next;
      })
      .catch(() => null)
      .finally(() => {
        acquiring = null;
      }));
  };

  /** A device change: the new default device's track first, then the old
   * one goes. Asked while the old one is live, so no prompt, on or off. */
  async function replace() {
    const next = await acquire();
    if (closed) return next?.stop();
    if (!next) return;
    const old = track;
    track = next;
    if (old !== next) old?.stop();
    if (wanted) set("on");
  }

  const onDeviceChange = () => {
    if (track) void replace();
  };
  media?.addEventListener("devicechange", onDeviceChange);

  return {
    async on() {
      if (closed) return;
      wanted = true;
      if (track?.readyState === "live") return set("on");
      set(permission?.state === "prompt" ? "asking" : "acquiring");
      const next = await acquire();
      if (closed) return next?.stop();
      if (next) track = next;
      if (!wanted) return; // turned off while asking; the track is kept
      set(next ? "on" : "blocked");
    },

    off() {
      if (closed) return;
      wanted = false;
      if (state !== "off") set("off");
    },

    get state() {
      return state;
    },

    close() {
      closed = true;
      wanted = false;
      media?.removeEventListener("devicechange", onDeviceChange);
      permission?.removeEventListener("change", onPermission);
      track?.stop();
      track = null;
      setAudioSessionType("playback"); // REVERT: remove this line (iOS audio session)
    },
  };
}

/** "How to fix it" for a blocked mic (spec §10), for this device. An
 * installed app on Android keeps its permissions in Chrome (web.dev, WebAPKs);
 * on iPhone a fresh start asks again. */
export function micBlockedHelp(userAgent: string, ios: boolean): string {
  if (ios) return "Close Ominira and open it again, then choose Allow when asked.";
  if (/Android/.test(userAgent))
    return "Open Chrome › ⋮ › Settings › Site settings › Microphone, tap projectominira.org and choose Allow.";
  if (/Firefox\//.test(userAgent))
    return "Click the crossed-out mic by the address bar and clear the block.";
  if (/Safari\//.test(userAgent) && !/Chrome\/|Chromium\//.test(userAgent))
    return "In Safari's menu, open Settings for This Website and set Microphone to Allow.";
  return "Click the icon left of the address and set Microphone to Allow.";
}

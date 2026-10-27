import { describe, expect, test } from "bun:test";
import { createMic, micBlockedHelp, type MicState } from "./mic";

class FakeTrack {
  readyState: "live" | "ended" = "live";
  contentHint = "";
  private ended: (() => void)[] = [];
  constructor(readonly id: number) {}
  stop() {
    this.readyState = "ended";
  }
  addEventListener(_: "ended", fn: () => void) {
    this.ended.push(fn);
  }
  /** The device went away (unplugged). */
  end() {
    this.readyState = "ended";
    this.ended.forEach((fn) => fn());
  }
}

type Fail = "NotAllowedError" | "NotReadableError" | "NotFoundError";

function fakeMedia(options: { fail?: Fail } = {}) {
  const tracks: FakeTrack[] = [];
  let deviceChange: (() => void) | null = null;
  let held: Promise<void> | null = null;
  let resume: (() => void) | null = null;
  return {
    tracks,
    /** Hold the next getUserMedia until `resume()`. */
    pause() {
      held = new Promise<void>((r) => (resume = r));
    },
    resume() {
      held = null;
      resume?.();
    },
    changeDevice: () => deviceChange?.(),
    media: {
      async getUserMedia() {
        if (held) await held;
        if (options.fail) throw new DOMException("failed", options.fail);
        const track = new FakeTrack(tracks.length + 1);
        tracks.push(track);
        return { getAudioTracks: () => [track] };
      },
      addEventListener: (_: string, fn: () => void) => (deviceChange = fn),
      removeEventListener: () => (deviceChange = null),
    },
  };
}

/** The site's mic permission; `set` changes it as the browser's settings would. */
function fakePermission(initial: PermissionState) {
  const status = Object.assign(new EventTarget(), { state: initial });
  return {
    permissions: { query: async () => status as unknown as PermissionStatus },
    set(state: PermissionState) {
      status.state = state;
      status.dispatchEvent(new Event("change"));
    },
  };
}

function setup(options: { fail?: Fail; site?: PermissionState } = {}) {
  const fake = fakeMedia(options);
  const permission = fakePermission(options.site ?? "granted");
  const changes: [MicState, number | null][] = [];
  let allowed = 0;
  const mic = createMic({
    media: fake.media as never,
    permissions: permission.permissions,
    onAllowed: () => allowed++,
    onChange: (state, track) => changes.push([state, track ? (track as unknown as FakeTrack).id : null]),
  });
  return { fake, mic, changes, permission, allowed: () => allowed, last: () => changes[changes.length - 1] };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("createMic", () => {
  test("first on asks once, marks the track as speech, hands it over", async () => {
    const { fake, mic, changes } = setup();
    await mic.on();
    expect(changes).toEqual([
      ["acquiring", null],
      ["on", 1],
    ]);
    expect(fake.tracks[0].contentHint).toBe("speech");
  });

  test("off hands over null and keeps the track, however long; on again reuses it", async () => {
    const { fake, mic, last } = setup();
    await mic.on();
    mic.off();
    expect(last()).toEqual(["off", null]);
    await wait(30);
    expect(fake.tracks[0].readyState).toBe("live");
    await mic.on();
    expect(last()).toEqual(["on", 1]);
    expect(fake.tracks.length).toBe(1);
  });

  test("denied, busy or no mic: blocked, no track", async () => {
    for (const fail of ["NotAllowedError", "NotReadableError", "NotFoundError"] as const) {
      const { mic, last } = setup({ fail });
      await mic.on();
      expect(last()).toEqual(["blocked", null]);
      expect(mic.state).toBe("blocked");
    }
  });

  test("while the browser asks: asking, then on", async () => {
    const { mic, changes } = setup({ site: "prompt" });
    await wait(0);
    await mic.on();
    expect(changes).toEqual([
      ["asking", null],
      ["on", 1],
    ]);
  });

  test("blocked, then allowed in settings: onAllowed", async () => {
    const { mic, permission, allowed } = setup({ fail: "NotAllowedError", site: "denied" });
    await wait(0);
    await mic.on();
    permission.set("granted");
    expect(allowed()).toBe(1);
  });

  test("a permission change while not blocked does nothing", async () => {
    const { mic, permission, allowed } = setup();
    await wait(0);
    await mic.on();
    permission.set("prompt");
    expect(allowed()).toBe(0);
  });

  test("no getUserMedia: blocked", async () => {
    const changes: MicState[] = [];
    const media = { addEventListener: () => {}, removeEventListener: () => {} };
    const mic = createMic({ media: media as never, onChange: (state) => changes.push(state) });
    await mic.on();
    expect(changes[changes.length - 1]).toBe("blocked");
  });

  test("off while still asking ends off, and the late track is kept for the next on", async () => {
    const { fake, mic, last } = setup();
    fake.pause();
    const pending = mic.on();
    mic.off();
    expect(last()).toEqual(["off", null]);
    fake.resume();
    await pending;
    expect(mic.state).toBe("off");
    await mic.on();
    expect(last()).toEqual(["on", 1]);
    expect(fake.tracks.length).toBe(1);
  });

  test("a device change while on swaps in a new track, then stops the old", async () => {
    const { fake, mic, last } = setup();
    await mic.on();
    fake.changeDevice();
    await wait(0);
    expect(last()).toEqual(["on", 2]);
    expect(fake.tracks[0].readyState).toBe("ended");
  });

  test("a device change while off swaps the held track, still off", async () => {
    const { fake, mic, last } = setup();
    await mic.on();
    mic.off();
    fake.changeDevice();
    await wait(0);
    expect(last()).toEqual(["off", null]);
    expect(fake.tracks[0].readyState).toBe("ended");
    expect(fake.tracks[1].readyState).toBe("live");
  });

  test("an unplugged mic while on is reacquired", async () => {
    const { fake, mic, last } = setup();
    await mic.on();
    fake.tracks[0].end();
    await wait(0);
    expect(last()).toEqual(["on", 2]);
  });

  test("close stops the track and ignores later calls", async () => {
    const { fake, mic, changes } = setup();
    await mic.on();
    mic.close();
    expect(fake.tracks[0].readyState).toBe("ended");
    const before = changes.length;
    await mic.on();
    mic.off();
    expect(changes.length).toBe(before);
  });
});

describe("micBlockedHelp", () => {
  const chrome = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
  const safari = "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
  const firefox = "Mozilla/5.0 (Macintosh; rv:131.0) Gecko/20100101 Firefox/131.0";
  const android = "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";

  test("per device", () => {
    expect(micBlockedHelp(android, false)).toContain("Site settings › Microphone");
    expect(micBlockedHelp(safari, true)).toContain("open it again");
    expect(micBlockedHelp(chrome, false)).toContain("left of the address");
    expect(micBlockedHelp(safari, false)).toContain("Settings for This Website");
    expect(micBlockedHelp(firefox, false)).toContain("crossed-out mic");
  });
});

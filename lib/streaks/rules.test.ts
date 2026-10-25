import { expect, test } from "bun:test";
import { advance, atRisk, EMPTY_STREAK, liveDays, markCrossed, markLine, restore, startFresh, streakState, type Streak } from "./rules";

/** A run of `days` ending on `lastDay`. */
const run = (days: number, lastDay: string, more: Partial<Streak> = {}): Streak => ({
  ...EMPTY_STREAK,
  current: days,
  best: days,
  lastDay,
  ...more,
});

test("the first day starts a run of one", () => {
  const { streak, mark } = advance(EMPTY_STREAK, "2026-10-10");
  expect(streak).toMatchObject({ current: 1, best: 1, lastDay: "2026-10-10" });
  expect(mark).toBeNull();
  expect(streakState(EMPTY_STREAK, "2026-10-10")).toEqual({ kind: "none" });
});

test("each next day adds one; the same day changes nothing", () => {
  const s = run(3, "2026-10-09");
  expect(advance(s, "2026-10-10").streak).toMatchObject({ current: 4, best: 4, lastDay: "2026-10-10" });
  expect(advance(s, "2026-10-09").streak).toBe(s);
  expect(advance(s, "2026-10-08").streak).toBe(s);
});

test("a gap starts over, keeping best", () => {
  const s = run(5, "2026-10-05", { best: 9 });
  expect(advance(s, "2026-10-10").streak).toMatchObject({ current: 1, best: 9, previous: 0 });
});

test("the four states against today", () => {
  const s = run(12, "2026-10-10", { best: 23 });
  expect(streakState(s, "2026-10-10")).toEqual({ kind: "kept", days: 12 });
  expect(streakState(s, "2026-10-11")).toEqual({ kind: "open", days: 12 });
  expect(streakState(s, "2026-10-12")).toEqual({ kind: "restore", days: 12 });
  expect(streakState(s, "2026-10-13")).toEqual({ kind: "ended", days: 12, best: 23 });
  expect(liveDays(streakState(s, "2026-10-11"))).toBe(12);
  expect(liveDays(streakState(s, "2026-10-13"))).toBe(0);
});

test("restore needs a run past 7 days and a month's restore unused", () => {
  expect(streakState(run(7, "2026-10-10"), "2026-10-12").kind).toBe("ended");
  expect(streakState(run(8, "2026-10-10"), "2026-10-12").kind).toBe("restore");
  expect(streakState(run(12, "2026-10-10", { restoreMonth: "2026-10-01" }), "2026-10-12").kind).toBe("ended");
  // Last month's restore doesn't count against this one.
  expect(streakState(run(12, "2026-09-29", { restoreMonth: "2026-09-01" }), "2026-10-01").kind).toBe("restore");
});

test("restore before reading today: yesterday counts and the run goes on", () => {
  const out = restore(run(12, "2026-10-10"), "2026-10-12")!;
  expect(out.day).toBe("2026-10-11");
  expect(out.streak).toMatchObject({ current: 13, lastDay: "2026-10-11", restoreMonth: "2026-10-01" });
  expect(streakState(out.streak, "2026-10-12")).toEqual({ kind: "open", days: 13 });
  expect(restore(out.streak, "2026-10-12")).toBeNull();
});

test("reading after a missed day still offers the restore that day", () => {
  const read = advance(run(12, "2026-10-10"), "2026-10-12").streak;
  expect(read).toMatchObject({ current: 1, previous: 12 });
  expect(streakState(read, "2026-10-12")).toEqual({ kind: "restore", days: 12 });
  const out = restore(read, "2026-10-12")!;
  expect(out.streak).toMatchObject({ current: 14, best: 14, lastDay: "2026-10-12", previous: 0 });
  expect(streakState(out.streak, "2026-10-12")).toEqual({ kind: "kept", days: 14 });
  // The next day the old run is gone.
  expect(streakState(read, "2026-10-13")).toEqual({ kind: "open", days: 1 });
});

test("start fresh ends the old run and drops the offer", () => {
  const s = run(12, "2026-10-10", { best: 23 });
  expect(streakState(startFresh(s, "2026-10-12"), "2026-10-12")).toEqual({ kind: "ended", days: 12, best: 23 });
  const read = advance(s, "2026-10-12").streak;
  expect(streakState(startFresh(read, "2026-10-12"), "2026-10-12")).toEqual({ kind: "kept", days: 1 });
  expect(restore(startFresh(s, "2026-10-12"), "2026-10-12")).toBeNull();
});

test("marks: reached by a day or by a restore", () => {
  expect(advance(run(6, "2026-10-09"), "2026-10-10").mark).toBe(7);
  expect(advance(run(7, "2026-10-09"), "2026-10-10").mark).toBeNull();
  expect(restore(run(29, "2026-10-10"), "2026-10-12")!.mark).toBe(30);
  expect(markCrossed(0, 1)).toBeNull();
  expect(markCrossed(5, 400)).toBe(365);
  expect(markLine(30)).toBe("30 days. A month of reading, every day.");
});

test("at risk: alive and not yet read today", () => {
  expect(atRisk(run(3, "2026-10-09"), "2026-10-10")).toBe(true);
  expect(atRisk(run(3, "2026-10-10"), "2026-10-10")).toBe(false);
  expect(atRisk(run(3, "2026-10-08"), "2026-10-10")).toBe(false);
});

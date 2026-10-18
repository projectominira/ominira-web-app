import { describe, expect, test } from "bun:test";
import type { StreakView } from "@/lib/streaks/types";
import { chapterEnds } from "@/lib/groups/progress";
import { buildStrip, chapterLine, dailyGoal, GOAL, goalAt, goalFrom, goalLabel, goalShare, isGoal, statusLook, streakCopy, toMinutes, weekChain, type StripCandidate } from "./home";

const streak = (state: StreakView["state"], days: string[], milestone: number | null): StreakView => ({ today: "2026-10-13", state, best: 30, days, milestone });
const COLLECTIVE = 10100;

describe("weekChain", () => {
  test("Monday read, Tuesday today", () => {
    const { days, linked } = weekChain({ today: "2026-10-13", days: ["2026-10-12"] });
    expect(days.map((d) => d.state)).toEqual(["done", "today", "next", "next", "next", "next", "next"]);
    expect(days[0].day).toBe("2026-10-12");
    expect(linked).toEqual([false, true, false, false, false, false, false]);
  });
  test("today read", () => {
    const { days, linked } = weekChain({ today: "2026-10-13", days: ["2026-10-12", "2026-10-13"] });
    expect(days.map((d) => d.state).slice(0, 3)).toEqual(["done", "done", "next"]);
    expect(linked.slice(0, 3)).toEqual([false, true, true]);
  });
});

describe("streakCopy", () => {
  test("normal: minutes left and the collective", () => {
    expect(streakCopy(streak({ kind: "open", days: 12 }, ["2026-10-12"], null), { minutes: 42, goal: 60, collectiveMinutes: COLLECTIVE })).toEqual({
      title: "12-day streak",
      sub: "18 more minutes to make it 13. The collective has read 10,100 minutes today.",
    });
  });
  test("a milestone day reads like any other (the design has no milestone)", () => {
    const view = streak({ kind: "kept", days: 30 }, ["2026-10-12", "2026-10-13"], 30);
    expect(streakCopy(view, { minutes: 60, goal: 60, collectiveMinutes: COLLECTIVE }).sub).toBe("Goal met for today. The collective has read 10,100 minutes today.");
  });
  test("a new reader", () => {
    expect(streakCopy(streak({ kind: "none" }, [], null), { minutes: 0, goal: 60, collectiveMinutes: COLLECTIVE })).toMatchObject({
      title: "Start a streak",
      sub: "Read 60 minutes today to start one. The collective has read 10,100 minutes today.",
    });
  });
  test("goal met", () => {
    expect(streakCopy(streak({ kind: "open", days: 12 }, [], null), { minutes: 60, goal: 60, collectiveMinutes: 1 }).sub).toBe("Goal met for today. The collective has read 1 minute today.");
  });
});

describe("goal", () => {
  test("share caps at 1", () => {
    expect(goalShare({ minutes: 42, goal: 60 })).toBeCloseTo(0.7);
    expect(goalShare({ minutes: 90, goal: 60 })).toBe(1);
  });
});

describe("reading time", () => {
  test("whole minutes in a day's seconds", () => {
    expect(toMinutes(0)).toBe(0);
    expect(toMinutes(59)).toBe(0);
    expect(toMinutes(390)).toBe(6);
  });
  test("a reader who never set a goal has the fallback", () => {
    expect(dailyGoal(null)).toBe(GOAL.fallback);
    expect(dailyGoal(20)).toBe(20);
  });
  test("Adjust sets goals in range, on a step", () => {
    expect([30, 45, 90, 480].every(isGoal)).toBe(true);
    expect([0, 15, 40, 495, 60.5].some(isGoal)).toBe(false);
  });
  test("the slider: labels, and positions snapped to a quarter hour", () => {
    expect(goalLabel(45)).toBe("45 min");
    expect(goalLabel(60)).toBe("1 hr");
    expect(goalLabel(150)).toBe("2 hr 30 min");
    expect(goalAt(GOAL.min)).toBe(0);
    expect(goalAt(GOAL.max)).toBe(1);
    expect(goalFrom(-1)).toBe(GOAL.min);
    expect(goalFrom(2)).toBe(GOAL.max);
    expect(goalFrom(0.5)).toBe(255);
    expect(goalFrom(goalAt(120))).toBe(120);
  });
});

describe("chapterLine", () => {
  const ends = [
    { id: "c1", label: "Chapter 1: Concerning Violence", endPct: 30 },
    { id: "c2", label: "Chapter 2 — Spontaneity", endPct: 45 },
    { id: "c3", label: "Chapter 3. The Pitfalls of National Consciousness", endPct: 70 },
    { id: "c4", label: "On National Culture", endPct: 90 },
    { id: "c5", label: "Chapter 5", endPct: 100 },
  ];
  test("numbered labels as Ch. N · title", () => {
    expect(chapterLine(ends, 10)).toBe("Ch. 1 · Concerning Violence");
    expect(chapterLine(ends, 30)).toBe("Ch. 2 · Spontaneity");
    expect(chapterLine(ends, 42)).toBe("Ch. 2 · Spontaneity");
    expect(chapterLine(ends, 50)).toBe("Ch. 3 · The Pitfalls of National Consciousness");
  });
  test("an unnumbered or bare label as it is; no chapters, null", () => {
    expect(chapterLine(ends, 80)).toBe("On National Culture");
    expect(chapterLine(ends, 95)).toBe("Ch. 5");
    expect(chapterLine([], 50)).toBeNull();
  });
});

describe("chapterEnds", () => {
  const section = (id: string, label: string | null, kind: "front" | "body" | "back" = "body", children: never[] = []) => ({ id, label, kind, passageCount: 1, children });
  test("leaves out front and back matter, on the spine's scale", () => {
    const toc = [section("f", "Preface", "front"), section("a", "Chapter 1"), section("b", "Chapter 2"), section("z", "Notes", "back")];
    expect(chapterEnds(toc, ["f", "a", "b", "z"])).toEqual([
      { id: "a", label: "Chapter 1", endPct: 50 },
      { id: "b", label: "Chapter 2", endPct: 75 },
    ]);
  });
  test("no spine, no chapters", () => {
    expect(chapterEnds([section("a", "Chapter 1")], [])).toEqual([]);
  });
});

describe("buildStrip", () => {
  const c = (id: string, o: Partial<StripCandidate> = {}): StripCandidate => ({ id, kind: "book", name: id, cover: null, materialId: null, room: null, live: null, reading: 0, ...o });
  const ids = (items: { id: string }[]) => items.map((i) => i.id);

  test("the group first, then live books, then reading, busiest first", () => {
    const strip = buildStrip(c("group", { kind: "group", name: "Ominira Study Group", live: 23 }), [
      c("staterev", { reading: 3 }),
      c("pedagogy", { reading: 8 }),
      c("quiet"),
      c("live", { live: 4, reading: 9 }),
      c("europe", { reading: 5 }),
    ]);
    expect(ids(strip)).toEqual(["group", "live", "pedagogy", "europe", "staterev"]);
    expect(strip[0]).toEqual({ id: "group", kind: "group", name: "Ominira Study Group", label: "Study group", cover: null, materialId: null, room: null, reason: "live", count: 23 });
    expect(strip[1]).toMatchObject({ reason: "live", count: 4 });
  });

  test("a quiet group stays off, and a quiet day is empty", () => {
    expect(ids(buildStrip(c("group", { kind: "group" }), [c("a", { reading: 1 })]))).toEqual(["a"]);
    expect(buildStrip(c("group", { kind: "group" }), [c("quiet")])).toEqual([]);
  });
});

test("statusLook", () => {
  expect(statusLook({ reason: "live", count: 23 })).toEqual({ ring: "live", caption: "23 listening" });
  expect(statusLook({ reason: "reading", count: 8 })).toEqual({ ring: "brand", caption: "8 reading" });
});

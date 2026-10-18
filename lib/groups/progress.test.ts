import { describe, expect, test } from "bun:test";
import {
  targetDueOn,
  chapterEnds,
  dailyShare,
  expectedToday,
  groupMean,
  onTrackCount,
  personalCheckpoint,
  planCheckpoint,
  planDays,
  progressWord,
  targetFraction,
  type TargetPlan,
} from "./progress";
import type { TocSection } from "@/lib/api/types";

// Mon 5 Oct to Thu 8 Oct: four days, 34% → 52%, 4.5% a day.
const t: TargetPlan = { startPct: 34, endPct: 52, startsOn: "2026-10-05", dueOn: "2026-10-08" };

test("the group plan splits the target evenly, both ends included", () => {
  expect(planDays(t)).toBe(4);
  expect(dailyShare(t)).toBe(4.5);
  expect(planCheckpoint(t, "2026-10-05")).toBe(38.5);
  expect(planCheckpoint(t, "2026-10-08")).toBe(52);
  expect(planCheckpoint(t, "2026-10-04")).toBe(34);
  expect(planCheckpoint(t, "2026-10-12")).toBe(52);
});

test("a target due the day it's set is one day long", () => {
  expect(planDays({ ...t, dueOn: "2026-10-05" })).toBe(1);
  expect(planCheckpoint({ ...t, dueOn: "2026-10-05" }, "2026-10-05")).toBe(52);
});

test("expected today is the end of yesterday", () => {
  expect(expectedToday(t, "2026-10-05")).toBe(34);
  expect(expectedToday(t, "2026-10-07")).toBe(43);
});

test("the personal checkpoint spreads what's left over the days left", () => {
  // Tue, at 34%: 18 left over 3 days → 40%.
  expect(personalCheckpoint(t, 34, "2026-10-06")).toBe(40);
  // Behind the start counts from the start.
  expect(personalCheckpoint(t, 10, "2026-10-06")).toBe(40);
  // Due day: the rest of it.
  expect(personalCheckpoint(t, 45, "2026-10-08")).toBe(52);
  // Overdue still asks for the rest, today.
  expect(personalCheckpoint(t, 45, "2026-10-10")).toBe(52);
  expect(personalCheckpoint(t, 52, "2026-10-06")).toBeNull();
});

test("progress words never say behind", () => {
  // Wed: expected 43, a day's share 4.5.
  expect(progressWord(t, 43, "2026-10-07")).toBe("On track");
  expect(progressWord(t, 60, "2026-10-07")).toBe("On track");
  expect(progressWord(t, 38.5, "2026-10-07")).toBe("A little behind");
  expect(progressWord(t, 38, "2026-10-07")).toBe("Reading");
  expect(progressWord(t, null, "2026-10-07")).toBeNull();
});

test("N on track and the group mean", () => {
  expect(onTrackCount(t, [43, 50, 30, null], "2026-10-07")).toBe(2);
  expect(groupMean([40, 50, null])).toBe(45);
  expect(groupMean([null])).toBeNull();
});

test("the card's bar runs across the target span", () => {
  expect(targetFraction(t, 43)).toBe(0.5);
  expect(targetFraction(t, 10)).toBe(0);
  expect(targetFraction(t, 80)).toBe(1);
});

const section = (id: string, label: string | null, kind: TocSection["kind"] = "body", children: TocSection[] = []): TocSection => ({
  id,
  label,
  kind,
  passageCount: 1,
  children,
});

test("chapter ends sit where the reader's percentage will", () => {
  const toc = [
    section("cover", "Cover", "front"),
    section("part1", "Part One", "body", [section("c1", "Chapter 1"), section("c2", "Chapter 2")]),
    section("c3", "Chapter 3"),
    section("notes", "Notes", "back"),
    section("x", "Not in the spine"),
  ];
  const spine = ["cover", "c1", "c2", "c3", "notes"];
  expect(chapterEnds(toc, spine)).toEqual([
    { id: "c1", label: "Chapter 1", endPct: 40 },
    { id: "c2", label: "Chapter 2", endPct: 60 },
    { id: "c3", label: "Chapter 3", endPct: 80 },
  ]);
  expect(chapterEnds(toc, [])).toEqual([]);
});

describe("targetDueOn", () => {
  test("the end of this week", () => {
    expect(targetDueOn("2026-10-13", null)).toBe("2026-10-18");
    expect(targetDueOn("2026-10-18", null)).toBe("2026-10-18");
  });
  test("an edit keeps the running target's day", () => expect(targetDueOn("2026-10-13", { dueOn: "2026-10-15" })).toBe("2026-10-15"));
});

// Targets and progress (studygroup-spec.md §4.2). Pure: no I/O, shared by
// the target route, the cron reminder, and the UI. Everything is in
// percentages of the current book (`reader_activities.progress_percent`);
// days are local days in the group's timezone ("YYYY-MM-DD").

import { addDays, daysBetween, weekdayOf, type LocalDay } from "@/lib/time/zone";
import type { TocSection } from "@/lib/api/types";

/** The parts of a target the rules read. `startsOn` is the day it was set:
 * the group plan runs from there to `dueOn`, both included. */
export type TargetPlan = { startPct: number; endPct: number; startsOn: LocalDay; dueOn: LocalDay };

/** What others see (never ranked). Null when the reader hasn't started the
 * book. */
export type ProgressWord = "On track" | "A little behind" | "Reading";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round = (n: number) => Math.round(n * 10) / 10;

/** Days in the plan, at least one. */
export function planDays(t: TargetPlan): number {
  return Math.max(1, daysBetween(t.startsOn, t.dueOn) + 1);
}

/** One day's share of the target, in percent. */
export function dailyShare(t: TargetPlan): number {
  return (t.endPct - t.startPct) / planDays(t);
}

/** The group plan: where everyone should be by the end of `day`, an even
 * split from start to end. Before the plan it's the start; after, the end. */
export function planCheckpoint(t: TargetPlan, day: LocalDay): number {
  const done = clamp(daysBetween(t.startsOn, day) + 1, 0, planDays(t));
  return round(t.startPct + dailyShare(t) * done);
}

/** Where the group plan expects you to be today: the end of yesterday.
 * Today's share is still open. */
export function expectedToday(t: TargetPlan, today: LocalDay): number {
  return planCheckpoint(t, addDays(today, -1));
}

/** Your own checkpoint for today: what's left, spread over the days left
 * (today included). Null once you've reached the target. */
export function personalCheckpoint(t: TargetPlan, myPct: number, today: LocalDay): number | null {
  if (myPct >= t.endPct) return null;
  const base = Math.max(myPct, t.startPct);
  const daysLeft = Math.max(1, daysBetween(today, t.dueOn) + 1);
  return round(Math.min(t.endPct, base + (t.endPct - base) / daysLeft));
}

/** Progress in words (§4.2). Null when not started. */
export function progressWord(t: TargetPlan, myPct: number | null, today: LocalDay): ProgressWord | null {
  if (myPct === null) return null;
  const expected = expectedToday(t, today);
  if (myPct >= expected) return "On track";
  if (expected - myPct <= dailyShare(t)) return "A little behind";
  return "Reading";
}

/** "N of M on track": `pcts` has one entry per member, null for not
 * started (who count toward M, not N). */
export function onTrackCount(t: TargetPlan, pcts: (number | null)[], today: LocalDay): number {
  return pcts.filter((pct) => progressWord(t, pct, today) === "On track").length;
}

/** The group's progress: the mean of members who've started, rounded. Null
 * when no one has. */
export function groupMean(pcts: (number | null)[]): number | null {
  const started = pcts.filter((p): p is number => p !== null);
  if (started.length === 0) return null;
  return Math.round(started.reduce((sum, p) => sum + p, 0) / started.length);
}

/** How far through the target span `pct` is, 0–1, for the card's bar. */
export function targetFraction(t: TargetPlan, pct: number): number {
  const span = t.endPct - t.startPct;
  return span > 0 ? clamp((pct - t.startPct) / span, 0, 1) : 1;
}

/** One "Read up to" option (M7): a chapter (its section id, for a link to
 * it) and where it ends. */
export type ChapterEnd = { id: string; label: string; endPct: number };

/**
 * Every chapter end in the book, in reading order, with its percentage on
 * the same scale `progress_percent` uses (lib/reader/locator.ts: a spine
 * position over the spine's length), so "the end of Ch. 3" means the same
 * number the reader reports. Front and back matter, and parts that only
 * group chapters, are left out.
 */
export function chapterEnds(toc: TocSection[], spine: string[]): ChapterEnd[] {
  if (spine.length === 0) return [];
  const ends: ChapterEnd[] = [];
  const walk = (sections: TocSection[]) => {
    for (const s of sections) {
      if (s.children.length) walk(s.children);
      else if (s.label && s.kind !== "front" && s.kind !== "back") {
        const index = spine.indexOf(s.id);
        if (index >= 0) ends.push({ id: s.id, label: s.label, endPct: Math.round(((index + 1) / spine.length) * 100) });
      }
    }
  };
  walk(toc);
  // Keep the last label for each end, in order (two sections can share a
  // spine slot's end percentage once rounded).
  return ends.filter((end, i) => ends[i + 1]?.endPct !== end.endPct);
}

/** When a new target is due: the running one's day when there is one (an
 * edit keeps it), else the end of this week, Sunday (today on a Sunday). */
export function targetDueOn(today: LocalDay, running: { dueOn: LocalDay } | null): LocalDay {
  return running?.dueOn ?? addDays(today, 6 - weekdayOf(today));
}

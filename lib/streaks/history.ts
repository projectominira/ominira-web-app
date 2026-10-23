import { addDays, daysBetween, weekdayOf, type LocalDay } from "@/lib/time/zone";
import type { ReadingHistory } from "@/lib/streaks/types";

// /history's view of a ReadingHistory: a month's calendar and totals. Pure, for the page.

/** A month's (1–12) days for a calendar, Monday first: null pads the start. */
export function monthGrid(year: number, month: number): (LocalDay | null)[] {
  const first = `${year}-${`${month}`.padStart(2, "0")}-01`;
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${`${month + 1}`.padStart(2, "0")}-01`;
  return [...Array<null>(weekdayOf(first)).fill(null), ...Array.from({ length: daysBetween(first, next) }, (_, i) => addDays(first, i))];
}

/** "Thu 1 Oct", or with `long` "Thursday 1 October". */
export const dayLabel = (day: LocalDay, long = false) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: long ? "long" : "short", day: "numeric", month: long ? "long" : "short", timeZone: "UTC" });

/** The grid's shade for a day read for `seconds`: 0 unread, 1–4 by minutes. */
export function shade(read: boolean, seconds: number): 0 | 1 | 2 | 3 | 4 {
  if (!read) return 0;
  const m = seconds / 60;
  return m >= 60 ? 4 : m >= 30 ? 3 : m >= 10 ? 2 : 1;
}

/** "Under a minute", "45 min", "2 h", "2 h 5 min". */
export function timeLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 1) return "Under a minute";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

/** The longest run of consecutive days in ascending `days`. */
export function longestRun(days: LocalDay[]): number {
  let best = 0;
  let run = 0;
  days.forEach((d, i) => {
    run = i > 0 && daysBetween(days[i - 1], d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

export type MonthSummary = {
  seconds: number;
  daysRead: number;
  longestRun: number;
  /** The day read longest, null when no time was kept. */
  bestDay: { day: LocalDay; seconds: number } | null;
};

/** `month` (1–12) of `history.year` at a glance. */
export function monthSummary(history: ReadingHistory, month: number): MonthSummary {
  const days = history.days.filter((d) => +d.day.slice(5, 7) === month);
  const bestDay = days.reduce<MonthSummary["bestDay"]>((b, d) => (d.seconds > (b?.seconds ?? 0) ? { day: d.day, seconds: d.seconds } : b), null);
  return {
    seconds: days.reduce((s, d) => s + d.seconds, 0),
    daysRead: days.length,
    longestRun: longestRun(days.map((d) => d.day)),
    bestDay,
  };
}

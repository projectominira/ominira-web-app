import { addDays, daysBetween, weekdayOf, type LocalDay } from "@/lib/time/zone";
import { goalLabel } from "@/lib/rooms/home";
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

/** "Under a minute", "45 min", "2 h", "2 h 5 min". */
export function timeLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 1) return "Under a minute";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

/** In full, for a sentence: "under a minute", "24 minutes", "2 hours 40 minutes". */
export const timeLong = (seconds: number) => (seconds < 60 ? "under a minute" : goalLabel(Math.floor(seconds / 60)));

export type HistoryDay = ReadingHistory["days"][number];

/** Read that day: time kept, or a streak day from before time was. */
export const wasRead = (d: HistoryDay) => d.seconds > 0 || d.streak === "met";

/** A picked day in a sentence: its time against its goal, and the streak. */
export function dayNote(day: LocalDay, d: HistoryDay | undefined, today: LocalDay): string {
  const time = d?.seconds ? timeLong(d.seconds) : null;
  const goal = d?.goal ? goalLabel(d.goal) : null;
  if (d?.streak === "met") {
    if (!time) return "You read and kept your streak.";
    return goal ? `You read ${time}, meeting your goal of ${goal}.` : `You read ${time} and kept your streak.`;
  }
  if (d?.streak === "restored") return time ? `You read ${time}, short of your goal, but Restore kept your streak.` : "You didn’t read, but Restore kept your streak.";
  if (day === today) return time ? `You’ve read ${time} so far.${goal ? ` Your goal is ${goal}.` : ""}` : "You haven’t read yet today.";
  return time ? `You read ${time}.${goal ? ` Your goal was ${goal}.` : ""}` : "You didn’t read.";
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
  /** Days the goal was met (the streak's days, restored ones aside). */
  goalDays: number;
  /** The longest streak inside the month. */
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
    daysRead: days.filter(wasRead).length,
    goalDays: days.filter((d) => d.streak === "met").length,
    longestRun: longestRun(days.filter((d) => d.streak).map((d) => d.day)),
    bestDay,
  };
}

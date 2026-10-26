import type { StreakState } from "@/lib/streaks/rules";

/** `GET /api/auth/me/streak`: the reader's streak today (C1). */
export type StreakView = {
  /** Today, the reader's local day. */
  today: string;
  state: StreakState;
  best: number;
  /** Days the goal was met (or restored) in the week to today: the 7-day strip. */
  days: string[];
  /** A streak mark reached today: the milestone card (7 / 30 / 100 / 365). */
  milestone: number | null;
};

/** `GET /api/auth/me/history?year=`: a year of the reader's reading, in
 * their local days (lib/streaks/history.ts shapes it for /history). */
export type ReadingHistory = {
  year: number;
  today: string;
  /** The reader's daily goal now, in minutes. */
  goal: number;
  /** Each day read or kept, ascending. `seconds` is 0 when only the day is
   * known (read before time was kept); `goal`, in minutes, null before
   * goals were kept per day. `streak`: the goal was met ("met", or simply
   * read before the goal counted), Restore kept it, or neither. */
  days: { day: string; seconds: number; goal: number | null; streak: "met" | "restored" | null }[];
  /** The reader's first day read: the calendar and switchers start there. */
  firstDay: string;
};

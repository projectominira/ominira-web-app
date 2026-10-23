import type { StreakState } from "@/lib/streaks/rules";

/** `GET /api/auth/me/streak`: the reader's streak today (C1). */
export type StreakView = {
  /** Today, the reader's local day. */
  today: string;
  state: StreakState;
  best: number;
  /** Days read (or restored) in the week to today: the 7-day strip. */
  days: string[];
  /** A streak mark reached today: the milestone card (7 / 30 / 100 / 365). */
  milestone: number | null;
};

/** `GET /api/auth/me/history?year=`: a year of the reader's reading, in
 * their local days (lib/streaks/history.ts shapes it for /history). */
export type ReadingHistory = {
  year: number;
  today: string;
  /** Each day read, ascending, with its seconds (0 when only the day is
   * known: read before time was kept). */
  days: { day: string; seconds: number }[];
  /** The reader's first day read: the calendar and switchers start there. */
  firstDay: string;
};

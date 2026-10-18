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

// Reading streaks (studygroup-spec.md §4.4, C1). Pure: no I/O, shared by the
// recorder, the restore route, the cron's `streak_risk` and the UI. Days are
// the reader's local days ("YYYY-MM-DD", lib/time/zone.ts).
//
// The stored streak is the run ending at `lastDay`; whether it's still alive
// is read against today, so a missed day needs no job to close it.

import { addDays, daysBetween, type LocalDay } from "@/lib/time/zone";

export type Streak = {
  /** Days in the run ending at `lastDay`. */
  current: number;
  best: number;
  /** The latest day read (or restored); null before the first. */
  lastDay: LocalDay | null;
  /** The run a single missed day just ended, kept for the day the reader
   * read again so Restore can still bring it back; 0 otherwise. */
  previous: number;
  /** First day of the month the last restore was used in. */
  restoreMonth: LocalDay | null;
  /** The day the reader chose Start fresh. */
  declinedOn: LocalDay | null;
};

export const EMPTY_STREAK: Streak = { current: 0, best: 0, lastDay: null, previous: 0, restoreMonth: null, declinedOn: null };

/** Streak marks (milestone card, `milestone`). */
export const MARKS = [7, 30, 100, 365] as const;

/** Restore is offered once a run has passed this many days. */
export const RESTORE_AFTER = 7;

export type StreakState =
  | { kind: "none" }
  /** Read today. */
  | { kind: "kept"; days: number }
  /** Alive, not yet read today ("One read before midnight keeps it going"). */
  | { kind: "open"; days: number }
  /** Missed yesterday, and the run can come back ("Keep your 12 days?"). */
  | { kind: "restore"; days: number }
  /** "Day one, again · You read 12 days in a row. Your best is 23." */
  | { kind: "ended"; days: number; best: number };

const monthOf = (day: LocalDay) => `${day.slice(0, 7)}-01`;

/** The highest mark passed going from `from` to `to` days, if any. */
export function markCrossed(from: number, to: number): number | null {
  return [...MARKS].reverse().find((m) => from < m && m <= to) ?? null;
}

function canRestore(s: Streak, run: number, today: LocalDay): boolean {
  return run > RESTORE_AFTER && s.restoreMonth !== monthOf(today) && s.declinedOn !== today;
}

export function streakState(s: Streak, today: LocalDay): StreakState {
  if (!s.lastDay || s.current === 0) return { kind: "none" };
  const gap = daysBetween(s.lastDay, today);
  if (gap === 2 && canRestore(s, s.current, today)) return { kind: "restore", days: s.current };
  // Read again today after the miss: the old run waits in `previous`.
  if (gap === 0 && s.current === 1 && s.previous > 0 && canRestore(s, s.previous, today)) {
    return { kind: "restore", days: s.previous };
  }
  if (gap <= 0) return { kind: "kept", days: s.current };
  if (gap === 1) return { kind: "open", days: s.current };
  return { kind: "ended", days: s.current, best: s.best };
}

/** The days the streak shows as kept going, today included: what
 * "12-day streak" counts. 0 once it has ended. */
export function liveDays(state: StreakState): number {
  return state.kind === "kept" || state.kind === "open" ? state.days : 0;
}

/** Records a day read. A later day extends the run or starts a new one;
 * the same or an earlier day changes nothing. `mark` is a streak mark just
 * reached. */
export function advance(s: Streak, day: LocalDay): { streak: Streak; mark: number | null } {
  if (s.lastDay && day <= s.lastDay) return { streak: s, mark: null };
  const gap = s.lastDay ? daysBetween(s.lastDay, day) : null;
  const current = gap === 1 ? s.current + 1 : 1;
  return {
    streak: { ...s, current, best: Math.max(s.best, current), lastDay: day, previous: gap === 2 ? s.current : 0 },
    mark: markCrossed(gap === 1 ? s.current : 0, current),
  };
}

/** Restore streak: yesterday counts as read and the run carries on. Null
 * when there's nothing to restore today. */
export function restore(s: Streak, today: LocalDay): { streak: Streak; day: LocalDay; mark: number | null } | null {
  const state = streakState(s, today);
  if (state.kind !== "restore") return null;
  const yesterday = addDays(today, -1);
  const readToday = s.lastDay === today;
  const current = state.days + 1 + (readToday ? s.current : 0);
  return {
    streak: {
      ...s,
      current,
      best: Math.max(s.best, current),
      lastDay: readToday ? today : yesterday,
      previous: 0,
      restoreMonth: monthOf(today),
    },
    day: yesterday,
    mark: markCrossed(state.days, current),
  };
}

/** Start fresh: the offer goes for today, and the old run ends. */
export function startFresh(s: Streak, today: LocalDay): Streak {
  return { ...s, previous: 0, declinedOn: today };
}

/** Whether the 19:00 `streak_risk` reminder applies: a live streak not yet
 * kept today. */
export const atRisk = (s: Streak, today: LocalDay) => streakState(s, today).kind === "open";

/** Milestone card and `milestone` copy. */
export function markLine(mark: number): string {
  const span: Record<number, string> = { 7: "A week", 30: "A month", 100: "A hundred days", 365: "A year" };
  return `${mark} days. ${span[mark] ?? `${mark} days`} of reading, every day.`;
}

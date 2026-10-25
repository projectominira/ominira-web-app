// Session rules (studygroup-spec.md §3.2 M8, §9.2), pure. Instants are epoch
// ms. A weekly session recurs at the same wall-clock time in the group's
// timezone, so 19:00 stays 19:00 across DST; each viewer sees it in their
// own zone.

import { addDays, localDay, zonedParts, zonedTime } from "@/lib/time/zone";

const MINUTE = 60_000;
const WEEK = 7 * 86_400_000;

/** A session is on for two hours from its start; after that it's past. */
export const SESSION_LENGTH = 120 * MINUTE;
/** "Starting soon", and the reminder (`session_soon`), an hour before. */
export const SOON = 60 * MINUTE;

export type SessionPhase = "upcoming" | "soon" | "on" | "past";

export function sessionPhase(startsAt: number, now: number): SessionPhase {
  if (now >= startsAt + SESSION_LENGTH) return "past";
  if (now >= startsAt) return "on";
  return now >= startsAt - SOON ? "soon" : "upcoming";
}

/** "19:00" in `tz`, 24-hour: M8's time field, and the reminder's line. */
export function wallTime(instant: number, tz: string): string {
  const { hour, minute } = zonedParts(instant, tz);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** The same wall-clock time `weeks` weeks on, in `tz`. */
export function weeksLater(startsAt: number, tz: string, weeks: number): number {
  return zonedTime(addDays(localDay(startsAt, tz), 7 * weeks), wallTime(startsAt, tz), tz);
}

/**
 * The occurrence a weekly series needs next, given its latest one: none
 * while the latest is still to come or on; once it's over (or skipped), the
 * first weekly slot after it that isn't over yet, so a series nobody looked
 * at for weeks resumes from the coming week.
 */
export function nextOccurrence(latest: { startsAt: number; cancelled: boolean }, tz: string, now: number): number | null {
  if (!latest.cancelled && sessionPhase(latest.startsAt, now) !== "past") return null;
  let weeks = Math.max(1, Math.floor((now - SESSION_LENGTH - latest.startsAt) / WEEK));
  let next = weeksLater(latest.startsAt, tz, weeks);
  while (next + SESSION_LENGTH <= now) next = weeksLater(latest.startsAt, tz, ++weeks);
  return next;
}

/** `session_soon` is due from an hour before the start until it starts. */
export const reminderDue = (startsAt: number, now: number) => sessionPhase(startsAt, now) === "soon";

/** What a reminder opt-out is keyed on: the series, or the single session. */
export const reminderKey = (session: { id: string; seriesId: string | null }) => session.seriesId ?? session.id;

/** The reminder's lead: "in an hour" for the 5-minute cron's first pass,
 * minutes when it's caught later. */
export function startsIn(startsAt: number, now: number): string {
  const minutes = Math.max(1, Math.round((startsAt - now) / MINUTE));
  return minutes >= 55 ? "in an hour" : `in ${minutes} min`;
}

/** The local days in `tz` that sessions fall on (the date picker's dots). */
export const sessionDays = (sessions: { startsAt: string }[], tz: string) => sessions.map((s) => localDay(Date.parse(s.startsAt), tz));

/** The session a room started now is for: the first one starting soon or
 * on (sessions come soonest first). */
export const dueSession = <T extends { startsAt: string }>(upcoming: T[], now: number): T | null =>
  upcoming.find((s) => {
    const phase = sessionPhase(Date.parse(s.startsAt), now);
    return phase === "soon" || phase === "on";
  }) ?? null;

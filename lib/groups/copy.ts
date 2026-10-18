// Group copy shared by the page header, the home card, Manage and the
// reading list.

import { formatDay, formatDayRange, formatInstant } from "@/lib/time/format";
import { daysBetween } from "@/lib/time/zone";
import type { GroupBook, GroupLiveRoom, SessionRepeat } from "@/lib/groups/types";

/** "1 comrade", "24 comrades". */
export function comradeCount(n: number): string {
  return `${n} ${n === 1 ? "comrade" : "comrades"}`;
}

export const groupHref = (slug: string) => `/groups/${slug}`;

export const readingListHref = (slug: string) => `${groupHref(slug)}?tab=reading-list`;

/** A reading-list row's dates (M9): "10 Sep – 29 Oct", "From 5 Nov", or
 * null when there are none. A done book runs to the day it was finished. */
export function bookDates({ status, startsOn, endsOn, finishedOn }: GroupBook): string | null {
  const end = status === "done" ? (finishedOn ?? endsOn) : endsOn;
  if (startsOn && end && end >= startsOn) return startsOn === end ? formatDay(end, "dayMonthLong") : formatDayRange(startsOn, end, "dayMonthLong");
  if (startsOn) return `From ${formatDay(startsOn, "dayMonthLong")}`;
  if (end) return `${status === "done" ? "Finished" : "Until"} ${formatDay(end, "dayMonthLong")}`;
  return null;
}

/** A chapter's label, short: "Chapter 3: Spontaneity" → "Ch. 3". Labels
 * that don't start "Chapter" stay as they are. */
export function chapterLabel(label: string): string {
  const match = /^chapter\s+([\w.]+)/i.exec(label.trim());
  return match ? `Ch. ${match[1].replace(/[.:]$/, "")}` : label.trim();
}

/** "Thursday" within the coming week, "9 Oct" beyond it. */
export function dueDay(dueOn: string, today: string): string {
  const days = daysBetween(today, dueOn);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return days > 0 && days < 7 ? formatDay(dueOn, "weekday") : formatDay(dueOn, "dayMonth");
}

/** The target in one line: "Ch. 3 by Thursday". */
export const targetTitle = (target: { endLabel: string; dueOn: string }, today: string) =>
  `${target.endLabel} by ${dueDay(target.dueOn, today)}`;

/** "34%", one decimal at most. */
export const pct = (n: number) => `${Math.round(n * 10) / 10}%`;

/** When a session is, where the viewer is: "Thu 15 Oct · 19:00". */
export const sessionWhen = (startsAt: string) => `${formatInstant(startsAt, "day")} · ${formatInstant(startsAt, "time")}`;

export const repeatLabel = (repeat: SessionRepeat) => (repeat === "weekly" ? "Every week" : "Once");

/** "1 session", "4 sessions". */
export const sessionCount = (n: number) => `${n} ${n === 1 ? "session" : "sessions"}`;

/** Who's in the live room: "Ama and 9 comrades", "Ama is in". */
export function liveLine({ starterName, members }: Pick<GroupLiveRoom, "starterName" | "members">): string {
  const name = starterName;
  const others = members - 1;
  return others > 0 ? `${name} and ${comradeCount(others)}` : `${name} is in`;
}

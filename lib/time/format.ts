// Date and time labels on native `Intl`, in the viewer's locale. `tz`
// defaults to the device zone; pass one to show an instant somewhere else
// (a group's session time, a server-side email). Local days ("2026-10-08",
// ./zone.ts) have no zone and go through formatDay. Relative "ago" labels
// are in ./relative.ts, elapsed time in ./duration.ts.

import type { LocalDay } from "./zone";

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(style: keyof typeof STYLES, tz?: string) {
  const key = `${style}|${tz ?? ""}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, { ...STYLES[style], timeZone: tz });
    formatters.set(key, f);
  }
  return f;
}

const STYLES = {
  /** "19:00" (or "7:00 PM" where that's the locale's clock). */
  time: { hour: "2-digit", minute: "2-digit" },
  /** "Thu 9 Oct" */
  day: { weekday: "short", day: "numeric", month: "short" },
  /** "9 Oct 2026" */
  date: { day: "numeric", month: "short", year: "numeric" },
  /** "Thursday" */
  weekday: { weekday: "long" },
  /** "Thu" */
  weekdayShort: { weekday: "short" },
  /** "Oct" */
  monthShort: { month: "short" },
  /** "9" */
  dayNumber: { day: "numeric" },
  /** "9 Oct" */
  dayMonth: { day: "numeric", month: "short" },
  /** "9 October" */
  dayMonthLong: { day: "numeric", month: "long" },
  /** "Thursday 9 October" */
  dayLong: { weekday: "long", day: "numeric", month: "long" },
  /** "October 2026" */
  month: { month: "long", year: "numeric" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateStyle = keyof typeof STYLES;

export function formatInstant(instant: number | string | Date, style: DateStyle, tz?: string): string {
  const ms = typeof instant === "string" ? Date.parse(instant) : +instant;
  return formatter(style, tz).format(ms);
}

// Noon UTC, so no zone can push the label onto a neighbouring day.
const dayInstant = (day: LocalDay) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), 12);

export function formatDay(day: LocalDay, style: DateStyle): string {
  return formatter(style, "UTC").format(dayInstant(day));
}

/** "10 Sep – 29 Oct", collapsing what the two days share. */
export function formatDayRange(start: LocalDay, end: LocalDay, style: DateStyle = "dayMonth"): string {
  return formatter(style, "UTC").formatRange(dayInstant(start), dayInstant(end));
}

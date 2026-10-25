// Timezones and reader-local days (studygroup-spec §9.2), on native `Intl`
// only. Instants are epoch ms (what timestamptz round-trips to); a local day
// is a "YYYY-MM-DD" string, which compares and sorts as text.

export type LocalDay = string;

const DAY = 86_400_000;

/** The device's IANA zone, e.g. "Africa/Lagos". */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string) {
  let formatter = partsFormatters.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(tz, formatter);
  }
  return formatter;
}

/** Wall-clock fields of `instant` in `tz`. */
export function zonedParts(instant: number, tz: string) {
  const fields: Record<string, number> = {};
  for (const { type, value } of partsFormatter(tz).formatToParts(instant)) {
    if (type !== "literal") fields[type] = Number(value);
  }
  return { year: fields.year, month: fields.month, day: fields.day, hour: fields.hour, minute: fields.minute, second: fields.second };
}

/** How far `tz` is ahead of UTC at `instant`, in ms. */
function offsetAt(instant: number, tz: string): number {
  const p = zonedParts(instant, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The calendar day `instant` falls on in `tz`. */
export function localDay(instant: number, tz: string): LocalDay {
  const p = zonedParts(instant, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Minutes since local midnight, for "has 08:00 passed here yet" checks. */
export function localMinutes(instant: number, tz: string): number {
  const p = zonedParts(instant, tz);
  return p.hour * 60 + p.minute;
}

const dayMs = (day: LocalDay) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));

export function addDays(day: LocalDay, n: number): LocalDay {
  return new Date(dayMs(day) + n * DAY).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: LocalDay, b: LocalDay): number {
  return Math.round((dayMs(b) - dayMs(a)) / DAY);
}

/** 0 = Monday … 6 = Sunday (the app's weeks start on Monday). */
export function weekdayOf(day: LocalDay): number {
  return (new Date(dayMs(day)).getUTCDay() + 6) % 7;
}

/**
 * The instant a wall-clock time ("19:00") on `day` happens in `tz`, so a
 * weekly 19:00 stays 19:00 across DST. A time skipped by a spring-forward
 * gap lands just after it; a repeated one takes its first occurrence.
 */
export function zonedTime(day: LocalDay, time: string, tz: string): number {
  const [hour, minute] = time.split(":").map(Number);
  const wall = dayMs(day) + (hour * 60 + minute) * 60_000;
  // The offsets either side of any transition that day; a candidate is real
  // when the zone actually has that offset at that instant.
  const before = offsetAt(wall - DAY, tz);
  const after = offsetAt(wall + DAY, tz);
  const real = [wall - before, wall - after].filter((t) => offsetAt(t, tz) === wall - t);
  return real.length ? Math.min(...real) : wall - before;
}

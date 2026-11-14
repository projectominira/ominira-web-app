import { addDays, weekdayOf, type LocalDay } from "@/lib/time/zone";

/** A dashboard period: a Monday–Sunday week or a calendar month. */
export type View = "week" | "month";
export type Period = { view: View; start: LocalDay; days: number };
/** What a period is compared with: the one before, the same one a year
 * earlier, nothing, or one picked (a period param, as in `periodParam`). */
export type Versus = "prev" | "year" | "none" | string;

/** Cookie remembering /admin's period controls are folded away; the page
 * reads it so it renders folded with no flash. */
export const FILTER_HIDDEN_COOKIE = "admin-filter-hidden";

const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

export function monthPeriod(year: number, month: number): Period {
  // Month arithmetic can run past December or before January.
  const d = new Date(Date.UTC(year, month - 1, 1));
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return { view: "month", start: `${y}-${pad(m)}-01`, days: daysInMonth(y, m) };
}

export const weekPeriod = (monday: LocalDay): Period => ({ view: "week", start: monday, days: 7 });

/** The period of `view` that `day` falls in. */
export function periodOf(view: View, day: LocalDay): Period {
  return view === "week" ? weekPeriod(addDays(day, -weekdayOf(day))) : monthPeriod(+day.slice(0, 4), +day.slice(5, 7));
}

/** `n` periods later (earlier when negative). */
export function shift(p: Period, n: number): Period {
  return p.view === "week" ? weekPeriod(addDays(p.start, 7 * n)) : monthPeriod(+p.start.slice(0, 4), +p.start.slice(5, 7) + n);
}

/** The same period a year earlier: the month, or the week 52 weeks back. */
export const yearBefore = (p: Period) => shift(p, p.view === "week" ? -52 : -12);

/** "2026-11-03" for a week (its Monday), "2026-11" for a month. */
export const periodParam = (p: Period) => (p.view === "week" ? p.start : p.start.slice(0, 7));

/** A period from its param, if it is one of `view`'s and has begun by `today`. */
export function parsePeriod(view: View, param: string | undefined, today: LocalDay): Period | null {
  if (!param) return null;
  let p: Period | null = null;
  if (view === "week" && /^\d{4}-\d{2}-\d{2}$/.test(param) && !Number.isNaN(Date.parse(param)) && weekdayOf(param) === 0) p = weekPeriod(param);
  if (view === "month" && /^\d{4}-(0[1-9]|1[0-2])$/.test(param)) p = monthPeriod(+param.slice(0, 4), +param.slice(5, 7));
  return p && p.start <= today ? p : null;
}

export function comparisonOf(p: Period, vs: Versus, today: LocalDay): Period {
  if (vs === "year") return yearBefore(p);
  if (vs !== "prev") {
    const picked = parsePeriod(p.view, vs, today);
    if (picked) return picked;
  }
  return shift(p, -1);
}

// Days are calendar dates; format them as UTC so they never shift.
const utc = (day: LocalDay) => new Date(`${day}T00:00:00Z`);
const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" });
const dayMonth = fmt({ month: "short", day: "numeric" });
const monthLong = fmt({ month: "long", year: "numeric" });
const monthShort = fmt({ month: "short", year: "numeric" });

/** "Nov 3 – 9, 2026" / "November 2026"; `short` drops the year from weeks
 * and abbreviates months ("Nov 3 – 9", "Nov 2026"). Weeks are assembled by
 * hand: formatRange's spacing differs between Node's and browsers' ICU, which
 * breaks hydration. */
export function periodLabel(p: Period, short = false): string {
  if (p.view === "month") return (short ? monthShort : monthLong).format(utc(p.start));
  const end = addDays(p.start, 6);
  const [from, to] = [p.start, end].map((d) => dayMonth.format(utc(d)));
  const [y1, y2] = [p.start.slice(0, 4), end.slice(0, 4)];
  if (y1 !== y2) return short ? `${from} – ${to}` : `${from}, ${y1} – ${to}, ${y2}`;
  const range = p.start.slice(5, 7) === end.slice(5, 7) ? `${from} – ${+end.slice(8)}` : `${from} – ${to}`;
  return short ? range : `${range}, ${y2}`;
}

/** How a comparison reads after a figure: "last week", "in Aug 2026". */
export function versusPhrase(p: Period, vs: Versus, compare: Period): string {
  if (vs === "prev" || periodParam(compare) === periodParam(shift(p, -1))) return `last ${p.view}`;
  return `in ${periodLabel(compare, compare.start.slice(0, 4) === p.start.slice(0, 4))}`;
}

/** The URL for a dashboard state; defaults are left out. */
export function dashboardHref(p: Period, vs: Versus, current: Period): string {
  const q = new URLSearchParams();
  if (p.view === "month") q.set("view", "month");
  if (periodParam(p) !== periodParam(current)) q.set("period", periodParam(p));
  if (vs !== "none") q.set("vs", vs);
  const s = q.toString();
  return s ? `/admin?${s}` : "/admin";
}

/** A period's columns in the daily tables: each day of a week, each 7-day
 * stretch of a month ("1–7" … "29–31"). `from`/`to` index its days. */
export function columnsOf(p: Period): { label: string; from: number; to: number }[] {
  if (p.view === "week") return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, i) => ({ label, from: i, to: i + 1 }));
  return Array.from({ length: Math.ceil(p.days / 7) }, (_, i) => {
    const to = Math.min(i * 7 + 7, p.days);
    return { label: `${i * 7 + 1}–${to}`, from: i * 7, to };
  });
}

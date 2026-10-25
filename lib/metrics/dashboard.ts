import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { addDays, localDay, weekdayOf, type LocalDay } from "@/lib/time/zone";

/** The zone /admin's days and Monday–Sunday weeks are counted in. */
export const DASHBOARD_TIME_ZONE = "Africa/Lagos";

export type WeekDay = { day: LocalDay; readers: number; seconds: number; newMembers: number };

export type WeeklyMetrics = {
  /** Days of the week that have begun: 7 for a past week, 1–7 for this one. */
  elapsed: number;
  /** Four weeks to this week's Sunday, oldest first: the last 14 are last week and this week. */
  days: WeekDay[];
  /** Distinct readers (WAU) over the elapsed days, this week and the same weekdays last week. */
  readers: number;
  readersPrev: number;
  /** Distinct readers over all of last week. */
  lastWeekReaders: number;
  /** Members who had joined by the end of the week, and by its start. */
  members: number;
  membersAtStart: number;
};

/** The Monday of the week `today` falls in, in DASHBOARD_TIME_ZONE. */
export function currentWeekStart(now = Date.now()): LocalDay {
  const today = localDay(now, DASHBOARD_TIME_ZONE);
  return addDays(today, -weekdayOf(today));
}

/** One week against the week before — public.admin_weekly_metrics()
 * (migrations/20261118_admin_weekly_dashboard.sql). */
export async function getWeeklyMetrics(weekStart: LocalDay): Promise<WeeklyMetrics> {
  const { data, error } = await getSupabaseAdminClient().rpc("admin_weekly_metrics", { week_start: weekStart });
  if (error || !data) throw new Error(`Could not load dashboard metrics: ${error?.message ?? "no data"}`);
  return data as unknown as WeeklyMetrics;
}

/** A reader of one week: seconds read on each day, Monday first, and in all. */
export type WeekReader = { pseudonym: string; seconds: number[]; total: number };

/** Everyone who read in the week, most time read first — public.admin_weekly_readers()
 * (migrations/20261121_admin_weekly_readers.sql). */
export async function getWeeklyReaders(weekStart: LocalDay): Promise<WeekReader[]> {
  const { data, error } = await getSupabaseAdminClient().rpc("admin_weekly_readers", { week_start: weekStart });
  if (error || !data) throw new Error(`Could not load weekly readers: ${error?.message ?? "no data"}`);
  return data as unknown as WeekReader[];
}

/** Relative change from `previous` to `current`, or null when there's no
 * baseline to compare against (a 0 → N week isn't a percentage). */
export function growthRate(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous : null;
}

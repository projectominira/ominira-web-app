import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { localDay, type LocalDay } from "@/lib/time/zone";
import type { Period } from "./period";

/** The zone /admin's days, weeks and months are counted in. */
export const DASHBOARD_TIME_ZONE = "Africa/Lagos";

export const dashboardToday = (now = Date.now()): LocalDay => localDay(now, DASHBOARD_TIME_ZONE);

export type DayFigures = { day: LocalDay; readers: number; seconds: number; newMembers: number };

export type PeriodMetrics = {
  /** Days of the period that have begun: all of a past one, 1+ of this one. */
  elapsed: number;
  /** Days of the comparison counted against them: as many as have elapsed
   * while the period runs, all of it after. */
  compared: number;
  /** Each day of the period, and of the comparison. */
  days: DayFigures[];
  compareDays: DayFigures[];
  /** Distinct readers in each 7-day stretch of the period that has begun. */
  weekReaders: number[];
  /** The same for the whole comparison, and its distinct readers in all. */
  compareWeekReaders: number[];
  compareReadersAll: number;
  /** Distinct readers over the elapsed days, and the compared days. */
  readers: number;
  readersCompare: number;
  /** Members who had joined by the period's end and start, and by the end of the compared days. */
  members: number;
  membersAtStart: number;
  membersCompare: number;
};

/** One period against another — public.admin_period_metrics()
 * (migrations/20261201_admin_period_dashboard.sql). */
export async function getPeriodMetrics(period: Period, compare: Period): Promise<PeriodMetrics> {
  const { data, error } = await getSupabaseAdminClient().rpc("admin_period_metrics", {
    p_start: period.start,
    p_days: period.days,
    c_start: compare.start,
    c_days: compare.days,
  });
  if (error || !data) throw new Error(`Could not load dashboard metrics: ${error?.message ?? "no data"}`);
  return data as unknown as PeriodMetrics;
}

/** A reader of the period: seconds read on each of its days, and in all. */
export type PeriodReader = { pseudonym: string; seconds: number[]; total: number };

/** Everyone who read in the period, most time read first — public.admin_period_readers(). */
export async function getPeriodReaders(period: Period): Promise<PeriodReader[]> {
  const { data, error } = await getSupabaseAdminClient().rpc("admin_period_readers", { p_start: period.start, p_days: period.days });
  if (error || !data) throw new Error(`Could not load readers: ${error?.message ?? "no data"}`);
  return data as unknown as PeriodReader[];
}

/** Relative change from `previous` to `current`, or null when there's no
 * baseline to compare against (a 0 → N period isn't a percentage). */
export function growthRate(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous : null;
}

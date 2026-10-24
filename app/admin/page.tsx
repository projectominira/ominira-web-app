import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import AdminPageHeader from "./AdminPageHeader";
import InfoTip from "./InfoTip";
import ActivityChart from "./ActivityChart";
import AdminMenu from "./AdminMenu";
import { currentWeekStart, getWeeklyMetrics, growthRate, type WeekDay } from "@/lib/metrics/dashboard";
import { addDays, weekdayOf } from "@/lib/time/zone";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Days are calendar dates ("2026-10-20"); format them as UTC so they never shift.
const dayFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const weekRange = (start: string) =>
  dayFormat.formatRange(new Date(`${start}T00:00:00Z`), new Date(`${addDays(start, 6)}T00:00:00Z`));

const formatCount = (n: number) => n.toLocaleString("en");
const minutes = (seconds: number) => Math.round(seconds / 60);

const sum = (days: WeekDay[], key: "readers" | "seconds" | "newMembers") => days.reduce((n, d) => n + d[key], 0);

/** `part` as a whole percentage of `whole`. */
const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/** `?week=` when it's a Monday no later than this week's, else this week. */
function weekFrom(param: string | undefined, current: string): string {
  if (!param || !/^\d{4}-\d{2}-\d{2}$/.test(param) || Number.isNaN(Date.parse(param))) return current;
  return weekdayOf(param) === 0 && param <= current ? param : current;
}

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const current = currentWeekStart();
  const week = weekFrom((await searchParams).week, current);
  const m = await getWeeklyMetrics(week);

  const lastWeek = m.days.slice(14, 21);
  const thisWeek = m.days.slice(21);
  // While a week runs, compare only the days that have begun with the same weekdays last week.
  const partial = m.elapsed < 7;
  const soFar = thisWeek.slice(0, m.elapsed);
  const sameDaysLastWeek = lastWeek.slice(0, m.elapsed);
  const through = WEEKDAYS[m.elapsed - 1];
  const lastWeekDetail = (n: string) => (partial ? `${n} by ${through} last week` : `${n} last week`);

  const seconds = sum(soFar, "seconds");
  const secondsPrev = sum(sameDaysLastWeek, "seconds");
  const joined = sum(soFar, "newMembers");
  // Share of members who read: this week against last week's members, who are
  // everyone that had joined by this week's start.
  const reading = share(m.readers, m.members);
  const readingPrev = share(m.readersPrev, m.membersAtStart);

  const rows = [
    { label: "Readers", value: (d: WeekDay) => d.readers, week: m.readers },
    { label: "Minutes read", value: (d: WeekDay) => minutes(d.seconds), week: minutes(seconds) },
    { label: "New members", value: (d: WeekDay) => d.newMembers, week: joined },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <AdminPageHeader
        title="Dashboard"
        back={null}
        actions={
          <>
            <nav aria-label="Week" className="mr-2 flex items-center gap-1">
              <WeekLink href={`/admin?week=${addDays(week, -7)}`} label="Previous week" icon={<ChevronLeft size={16} />} />
              <span className="px-1 text-[14px] font-bold text-[var(--reader-text)]">{weekRange(week)}</span>
              <WeekLink
                href={week < current ? (addDays(week, 7) === current ? "/admin" : `/admin?week=${addDays(week, 7)}`) : null}
                label="Next week"
                icon={<ChevronRight size={16} />}
              />
            </nav>
            <AdminMenu />
          </>
        }
      />


      {/* One card divided into cells by hairlines. Each cell draws its own
          right + bottom border; the grid overhangs by 1px so the outer
          edge's are clipped. */}
      <section aria-label="This week" className="overflow-hidden rounded-sm border border-[var(--reader-border)]">
        <div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-3">
          <Tile
            label="Members"
            info="Everyone who has created an account, as of the end of this week, and how much that grew over the week."
            value={formatCount(m.members)}
            detail={`+${formatCount(m.members - m.membersAtStart)} this week, from ${formatCount(m.membersAtStart)}`}
            change={growthRate(m.members, m.membersAtStart)}
          />
          <Tile
            label="Members reading"
            info="The share of members who read on at least one day this week."
            value={`${reading}%`}
            detail={`${formatCount(m.readers)} of ${formatCount(m.members)} · ${lastWeekDetail(`${readingPrev}%`)}`}
            change={m.membersAtStart ? (reading - readingPrev) / 100 : null}
            points
          />
          <Tile
            label="Minutes read"
            info="Total time members spent reading or listening this week."
            value={formatCount(minutes(seconds))}
            detail={lastWeekDetail(formatCount(minutes(secondsPrev)))}
            change={growthRate(seconds, secondsPrev)}
          />
        </div>
      </section>

      <section aria-labelledby="days-heading" className="mt-3 rounded-sm border border-[var(--reader-border)] p-5">
        <h2 id="days-heading" className="m-0 mb-4 text-[14px] font-bold text-[var(--reader-text)]">
          Reading activity
        </h2>
        <ActivityChart
          weekStart={week}
          data={m.days.map((d, i) => ({
            day: d.day,
            readers: i < 21 + m.elapsed ? d.readers : null,
            minutes: i < 21 + m.elapsed ? minutes(d.seconds) : null,
          }))}
        />

        <div className="-mx-5 mt-5 overflow-x-auto border-t border-[var(--reader-border)] px-5">
          <table className="w-full min-w-[560px] border-collapse text-[13px] tabular-nums">
            <thead>
              <tr className="text-[12px] font-semibold text-[var(--reader-text-muted)]">
                <th scope="col" className="py-3 text-left font-semibold">
                  <span className="sr-only">Figure</span>
                </th>
                {WEEKDAYS.map((d) => (
                  <th key={d} scope="col" className="py-3 text-right font-semibold">
                    {d}
                  </th>
                ))}
                <th scope="col" className="py-3 pl-4 text-right font-semibold">
                  Week
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Row key={row.label} {...row} days={thisWeek} elapsed={m.elapsed} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** A figure for each day of the week, then its week total; days yet to come show a dash. */
function Row({ label, value, week, days, elapsed }: { label: string; value: (d: WeekDay) => number; week: number; days: WeekDay[]; elapsed: number }) {
  return (
    <tr className="border-t border-[var(--reader-border)] text-[var(--reader-text)]">
      <th scope="row" className="py-2.5 text-left font-semibold">
        {label}
      </th>
      {days.map((d, i) => (
        <td key={d.day} className="py-2.5 text-right">
          {i < elapsed ? formatCount(value(d)) : <span className="text-[var(--reader-text-subtle)]">–</span>}
        </td>
      ))}
      <td className="py-2.5 pl-4 text-right font-bold">{formatCount(week)}</td>
    </tr>
  );
}

/** A ‹ or › step; without an `href` (no later week) it stays in place, disabled. */
function WeekLink({ href, label, icon }: { href: string | null; label: string; icon: React.ReactNode }) {
  const base = "inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--reader-border)]";
  if (!href) {
    return (
      <span aria-label={label} aria-disabled="true" className={`${base} text-[var(--reader-text-subtle)]`}>
        {icon}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={`${base} text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]`}>
      {icon}
    </Link>
  );
}

function Tile({
  label,
  info,
  value,
  detail,
  change,
  points,
}: {
  label: string;
  info: string;
  value: string;
  detail: string;
  change?: number | null;
  /** `change` is a difference of percentages, shown in points rather than as a growth rate. */
  points?: boolean;
}) {
  const hasChange = change !== undefined && change !== null;

  return (
    <div className="flex min-w-0 flex-col border-r border-b border-[var(--reader-border)] p-4 shell:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold text-[var(--reader-text-muted)]">{label}</span>
        <InfoTip label={label}>{info}</InfoTip>
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[26px] font-serif font-semibold leading-tight tracking-tight text-[var(--reader-text)]">{value}</span>
        {hasChange && (
          <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-[var(--reader-text)]">
            {change >= 0 ? (
              <ArrowUpRight size={13} className="text-emerald-500" aria-hidden />
            ) : (
              <ArrowDownRight size={13} className="text-[var(--reader-accent)]" aria-hidden />
            )}
            {change >= 0 ? "+" : ""}
            {Math.round(change * 100)}
            {points ? " pts" : "%"}
            <span className="sr-only"> vs last week</span>
          </span>
        )}
      </div>
      <span className="mt-1 text-[12px] font-medium leading-snug text-[var(--reader-text-muted)]">{detail}</span>
    </div>
  );
}

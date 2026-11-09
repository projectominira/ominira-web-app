import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import AdminPageHeader from "./AdminPageHeader";
import InfoTip from "./InfoTip";
import ActivityCompare, { type ActivityPanel, type BreakdownRow } from "./ActivityCompare";
import { cookies } from "next/headers";
import PeriodFilter from "./PeriodFilter";
import { dashboardToday, getPeriodMetrics, getPeriodReaders, growthRate, type DayFigures } from "@/lib/metrics/dashboard";
import { daysBetween } from "@/lib/time/zone";
import { FILTER_HIDDEN_COOKIE, columnsOf, comparisonOf, parsePeriod, periodLabel, periodOf, versusPhrase, type Period, type Versus, type View } from "@/lib/metrics/period";
import { pseudonymToSlug } from "@/lib/reader/profileSlug";
import { formatDuration } from "@/lib/time/duration";
import { daysPlanned } from "@/lib/passage/calendar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

const formatCount = (n: number) => n.toLocaleString("en");
const minutes = (seconds: number) => Math.round(seconds / 60);
/** "30 h 40 min"; nothing read reads "0 min" rather than "<1 min". */
const duration = (seconds: number) => (seconds ? formatDuration(seconds * 1000) : "0 min");

const sum = (days: DayFigures[], key: "readers" | "seconds" | "newMembers") => days.reduce((n, d) => n + d[key], 0);
const sumRange = (values: number[], from: number, to: number) => values.slice(from, to).reduce((n, v) => n + v, 0);

/** `part` as a whole percentage of `whole`. */
const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<{ view?: string; period?: string; vs?: string }> }) {
  const [params, jar] = await Promise.all([searchParams, cookies()]);
  const filterHidden = jar.get(FILTER_HIDDEN_COOKIE)?.value === "1";
  const today = dashboardToday();
  const view: View = params.view === "month" ? "month" : "week";
  const period = parsePeriod(view, params.period, today) ?? periodOf(view, today);
  const vs: Versus = params.vs || "prev";
  const compare = comparisonOf(period, vs, today);
  const comparing = vs !== "none";
  const [m, readers, plan] = await Promise.all([getPeriodMetrics(period, compare), getPeriodReaders(period), daysPlanned()]);

  const soFar = m.days.slice(0, m.elapsed);
  const compared = m.compareDays.slice(0, m.compared);
  // While the period runs, the comparison covers only as many of its first days.
  const partial = m.elapsed < period.days;
  const versus = versusPhrase(period, vs, compare);
  const through = period.view === "week" ? WEEKDAYS[m.elapsed - 1] : `the ${ordinal(m.elapsed)}`;
  const nowCaption = `${periodLabel(period, true)}${partial ? " · so far" : ""}`;
  const thenCaption = `${periodLabel(compare, true)}${partial ? ` · by ${through}` : ""}`;

  const seconds = sum(soFar, "seconds");
  const secondsCompare = sum(compared, "seconds");
  const joined = sum(soFar, "newMembers");
  const joinedCompare = sum(compared, "newMembers");
  const reading = share(m.readers, m.members);
  const readingCompare = share(m.readersCompare, m.membersCompare);

  // The comparison's own panel shows all of it that has begun.
  const compareElapsed = Math.max(0, Math.min(compare.days, daysBetween(compare.start, today) + 1));
  const panel = (p: Period, days: DayFigures[], elapsed: number, weekReaders: number[], readersAll: number, tone: ActivityPanel["tone"]): ActivityPanel => {
    // Week: a row per day. Month: per 7-day stretch, readers counted once per stretch.
    const rows: BreakdownRow[] = columnsOf(p).map((c, i) => {
      if (c.from >= elapsed) return { label: c.label, readers: null, time: null, joined: null };
      const span = days.slice(c.from, Math.min(c.to, elapsed));
      return {
        label: c.label,
        readers: formatCount(p.view === "month" ? weekReaders[i] : sum(span, "readers")),
        time: duration(sum(span, "seconds")),
        joined: formatCount(sum(span, "newMembers")),
      };
    });
    const begun = days.slice(0, elapsed);
    return {
      title: periodLabel(p),
      caption: tone === "accent" ? (elapsed < p.days ? `${elapsed} of ${p.days} days so far` : "") : "Compared with",
      tone,
      points: days.map((d, i) => ({
        day: d.day,
        label: p.view === "week" ? WEEKDAYS[i] : String(i + 1),
        readers: i < elapsed ? d.readers : null,
        minutes: i < elapsed ? minutes(d.seconds) : null,
      })),
      rows,
      total: { label: "Total", readers: formatCount(readersAll), time: duration(sum(begun, "seconds")), joined: formatCount(sum(begun, "newMembers")) },
    };
  };
  const panels = [panel(period, m.days, m.elapsed, m.weekReaders, m.readers, "accent")];
  if (comparing) panels.push(panel(compare, m.compareDays, compareElapsed, m.compareWeekReaders, m.compareReadersAll, "neutral"));
  const ticks = period.view === "week" ? [0, 1, 2, 3, 4, 5, 6] : [0, 7, 14, 21, 28];
  const columns = columnsOf(period);
  const started = (c: { from: number }) => c.from < m.elapsed;
  const unit = period.view === "week" ? "Week" : "Month";

  return (
    <div>
      <AdminPageHeader title="Overview" actions={<PeriodFilter period={period} compare={compare} vs={vs} today={today} hidden={filterHidden} />} />

      {/* Passages running low (passage-spec §8.4). */}
      {plan.count < 7 && (
        <p className="m-0 mb-4 rounded-sm bg-[var(--reader-surface-hover)] px-4 py-2.5 text-ui-sm text-[var(--reader-text)]">
          {plan.through
            ? `Passages planned to ${new Date(`${plan.through}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} · ${plan.count} day${plan.count === 1 ? "" : "s"} left · `
            : "No passage planned for tomorrow · "}
          <Link href="/admin/connector" className="font-semibold text-brand-500 no-underline hover:underline">
            Ask your AI for more
          </Link>
        </p>
      )}

      {/* One card divided into cells by hairlines. Each cell draws its own
          right + bottom border; the grid overhangs by 1px so the outer
          edge's are clipped. Each cell sets the period beside its comparison. */}
      <section aria-label={periodLabel(period)} className="overflow-hidden rounded-sm border border-[var(--reader-border)]">
        <div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-3">
          <Tile
            label="New members"
            info={`Accounts created this ${period.view}, against the same days of the comparison. Below: everyone with an account by then.`}
            now={{ caption: nowCaption, value: formatCount(joined), note: `${formatCount(m.members)} members in all` }}
            then={comparing ? { caption: thenCaption, value: formatCount(joinedCompare), note: `${formatCount(m.membersCompare)} members by then` } : undefined}
            change={comparing ? growthRate(joined, joinedCompare) : null}
            versus={versus}
          />
          <Tile
            label="Members reading"
            info={`The share of members who read on at least one day this ${period.view}, against the same days of the comparison.`}
            now={{ caption: nowCaption, value: `${reading}%`, note: `${formatCount(m.readers)} of ${formatCount(m.members)}` }}
            then={comparing ? { caption: thenCaption, value: `${readingCompare}%`, note: `${formatCount(m.readersCompare)} of ${formatCount(m.membersCompare)}` } : undefined}
            change={comparing && m.membersCompare ? (reading - readingCompare) / 100 : null}
            versus={versus}
            points
          />
          <Tile
            label="Time read"
            info={`Total time members spent reading or listening this ${period.view}, against the same days of the comparison.`}
            now={{ caption: nowCaption, value: duration(seconds) }}
            then={comparing ? { caption: thenCaption, value: duration(secondsCompare) } : undefined}
            change={comparing ? growthRate(seconds, secondsCompare) : null}
            versus={versus}
          />
        </div>
      </section>

      <ActivityCompare panels={panels} ticks={ticks} />

      <section aria-labelledby="readers-heading" className="mt-3 rounded-sm border border-[var(--reader-border)] p-5">
        <div className="flex items-start justify-between gap-2">
          <h2 id="readers-heading" className="m-0 text-[14px] font-bold text-[var(--reader-text)]">
            Readers this {period.view}
            <span className="ml-2 font-semibold text-[var(--reader-text-muted)]">{formatCount(readers.length)}</span>
          </h2>
          <InfoTip label={`Readers this ${period.view}`}>
            {`Everyone who read this ${period.view} and their time read ${period.view === "week" ? "each day" : "in each 7-day stretch"}, most time read first.`}
          </InfoTip>
        </div>
        {readers.length ? (
          <div className="-mx-5 mt-4 overflow-x-auto border-t border-[var(--reader-border)] px-5">
            <table className="w-full min-w-[560px] border-collapse text-[13px] tabular-nums">
              <thead>
                <tr className="text-[12px] font-semibold text-[var(--reader-text-muted)]">
                  <th scope="col" className="py-3 text-left font-semibold">
                    Reader
                  </th>
                  {columns.map((c) => (
                    <th key={c.label} scope="col" className="py-3 text-right font-semibold">
                      {c.label}
                    </th>
                  ))}
                  <th scope="col" className="py-3 pl-4 text-right font-semibold">
                    {unit}
                  </th>
                </tr>
              </thead>
              <tbody>
                {readers.map((r) => (
                  <tr key={r.pseudonym} className="border-t border-[var(--reader-border)] text-[var(--reader-text)]">
                    <th scope="row" className="max-w-[200px] truncate py-2.5 text-left font-semibold">
                      <Link href={`/@${pseudonymToSlug(r.pseudonym)}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {r.pseudonym}
                      </Link>
                    </th>
                    {columns.map((c) => {
                      const s = sumRange(r.seconds, c.from, c.to);
                      return (
                        <td key={c.label} className="py-2.5 text-right">
                          {!started(c) || !s ? <Dash /> : duration(s)}
                        </td>
                      );
                    })}
                    <td className="py-2.5 pl-4 text-right font-bold">{duration(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="m-0 mt-3 text-[13px] text-[var(--reader-text-muted)]">No one has read this {period.view} yet.</p>
        )}
      </section>
    </div>
  );
}

const Dash = () => <span className="text-[var(--reader-text-subtle)]">–</span>;

type Figure = { caption: string; value: string; note?: string };

function Tile({
  label,
  info,
  now,
  then,
  change,
  versus,
  points,
}: {
  label: string;
  info: string;
  now: Figure;
  /** The comparison's figure; none when nothing is compared. */
  then?: Figure;
  change: number | null;
  /** What `change` is against, for screen readers: "last week". */
  versus: string;
  /** `change` is a difference of percentages, shown in points rather than as a growth rate. */
  points?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col border-r border-b border-[var(--reader-border)] p-4 shell:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold text-[var(--reader-text-muted)]">{label}</span>
        <InfoTip label={label}>{info}</InfoTip>
      </div>
      <div className={`mt-3 grid gap-3 ${then ? "grid-cols-2" : "grid-cols-1"}`}>
        <FigureCell figure={now} strong />
        {then && <FigureCell figure={then} />}
      </div>
      {change !== null && (
        <span className="mt-3 inline-flex items-center gap-0.5 text-[12px] font-semibold text-[var(--reader-text)]">
          {change >= 0 ? <ArrowUpRight size={13} className="text-emerald-500" aria-hidden /> : <ArrowDownRight size={13} className="text-[var(--reader-accent)]" aria-hidden />}
          {change >= 0 ? "+" : ""}
          {Math.round(change * 100)}
          {points ? " pts" : "%"}
          <span className="font-medium text-[var(--reader-text-muted)]">&nbsp;{versus}</span>
        </span>
      )}
    </div>
  );
}

function FigureCell({ figure, strong }: { figure: Figure; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="m-0 truncate text-[11px] font-semibold text-[var(--reader-text-subtle)]">{figure.caption}</p>
      <p className={`m-0 mt-0.5 font-serif leading-tight font-semibold tracking-tight ${strong ? "text-[24px] text-[var(--reader-text)]" : "text-[24px] text-[var(--reader-text-muted)]"}`}>
        {figure.value}
      </p>
      {figure.note && <p className="m-0 mt-0.5 truncate text-[12px] font-medium text-[var(--reader-text-muted)]">{figure.note}</p>}
    </div>
  );
}

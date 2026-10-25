"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SearchableAppPage from "@/app/components/shell/SearchableAppPage";
import NoResults from "@/app/components/shared/NoResults";
import { useIsAuthenticated } from "@/lib/auth/useIsAuthenticated";
import { useReadingHistory } from "@/lib/streaks/hooks";
import { dayLabel, monthGrid, monthSummary, shade, timeLabel } from "@/lib/streaks/history";
import type { ReadingHistory } from "@/lib/streaks/types";

const EYEBROW = "text-ui-xs tracking-eyebrow uppercase";
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
/** A day's fill by shade (lib/streaks/history.ts `shade`): unread, then lighter to deeper. */
const FILL = ["bg-[var(--color-app-surface-muted)]", "bg-brand-100", "bg-brand-300", "bg-brand-500", "bg-brand-700"];
/** The day's number over its fill. */
const INK = ["text-[var(--color-app-text)]", "text-sand-900", "text-sand-900", "text-sand-25", "text-sand-25"];

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
/** Months as one count (year × 12 + month − 1), so arrows cross years. */
const monthIndex = (day: string) => +day.slice(0, 4) * 12 + +day.slice(5, 7) - 1;

/** /history: the reading habit, a month at a time (this one first): its
 * numbers beside its calendar; a day picked tells its time. */
export default function HistoryView() {
  const isAuthenticated = useIsAuthenticated();
  const [at, setAt] = useState(() => {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth();
  });
  const { data } = useReadingHistory(Math.floor(at / 12));

  return (
    <SearchableAppPage>
      <h1 className="font-serif type-3 text-balance mt-1 mb-6 text-[var(--reader-text)]">Reading history</h1>
      {!isAuthenticated ? (
        <NoResults message="Sign in to see how you’ve been reading." />
      ) : !data ? (
        <div className="h-[30rem] animate-pulse rounded-sm bg-[var(--color-app-surface-muted)]" aria-hidden />
      ) : (
        // The year before stays shown while the next loads: its days aren't this month's.
        <Month key={at} history={data} at={at} loading={data.year !== Math.floor(at / 12)} onGo={setAt} />
      )}
    </SearchableAppPage>
  );
}

/** One month: its time, days, longest streak and best day, and beside them
 * every day of it, read days shaded by time. */
function Month({ history, at, loading, onGo }: { history: ReadingHistory; at: number; loading: boolean; onGo: (at: number) => void }) {
  const month = (at % 12) + 1;
  const year = Math.floor(at / 12);
  const name = MONTH_NAMES[month - 1];
  const thisMonth = at === monthIndex(history.today);
  const [picked, setPicked] = useState<string | null>(null);
  const seconds = useMemo(() => (loading ? new Map<string, number>() : new Map(history.days.map((d) => [d.day, d.seconds]))), [history, loading]);
  const summary = useMemo(() => monthSummary(loading ? { ...history, days: [] } : history, month), [history, loading, month]);
  const cells = monthGrid(year, month);
  const pastDays = cells.filter((d) => d && d <= history.today).length;

  return (
    <section className="grid rounded-sm border border-[var(--color-app-border)] bg-[var(--reader-bg)] text-[var(--color-app-text)] md:grid-cols-[minmax(15rem,2fr)_3fr]">
      <div className={`flex flex-col p-5 max-md:border-b md:border-r border-[var(--color-app-border)] md:p-7 ${loading ? "animate-pulse" : ""}`}>
        <div className="-mt-1.5 -mr-2 flex items-center justify-between gap-3">
          <h2 className={`${EYEBROW} m-0 font-normal text-[var(--color-app-text-muted)]`}>
            {name} {year}
          </h2>
          <div className="flex items-center gap-1">
            <IconButton label="Previous month" disabled={at <= monthIndex(history.firstDay)} onClick={() => onGo(at - 1)}>
              <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
            </IconButton>
            <IconButton label="Next month" disabled={thisMonth} onClick={() => onGo(at + 1)}>
              <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
            </IconButton>
          </div>
        </div>
        <div className="mt-2 font-serif text-[40px] font-bold tracking-tight tabular-nums md:text-[48px]">
          {summary.seconds ? timeLabel(summary.seconds) : "—"}
        </div>
        <div className="mt-1.5 text-ui-sm text-[var(--color-app-text-secondary)]">
          {summary.daysRead ? `You read on ${days(summary.daysRead)} in ${name}` : thisMonth ? `You haven’t read in ${name} yet` : `You didn’t read in ${name}`}
        </div>

        <dl className="m-0 mt-6 flex flex-col divide-y divide-[var(--color-app-border)] border-t border-[var(--color-app-border)] md:mt-auto">
          <Stat label="Days you read" value={`${summary.daysRead} of ${pastDays}`} />
          <Stat label="Your longest streak" value={summary.longestRun ? days(summary.longestRun) : "—"} />
          <Stat label="Your best day" value={summary.bestDay ? timeLabel(summary.bestDay.seconds) : "—"} sub={summary.bestDay ? dayLabel(summary.bestDay.day) : undefined} />
        </dl>
      </div>

      <div className="p-4 md:p-7 md:pt-8">
        <div className={`mx-auto grid max-w-md grid-cols-7 gap-1.5 ${loading ? "animate-pulse" : ""}`}>
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="pb-1 text-center text-[11px] font-semibold text-[var(--color-app-text-muted)]">
              {d}
            </span>
          ))}
          {cells.map((day, j) => {
            if (!day) return <span key={j} />;
            const time = seconds.get(day) ?? 0;
            const level = shade(seconds.has(day), time);
            return (
              <button
                key={day}
                type="button"
                disabled={day > history.today}
                aria-pressed={picked === day}
                aria-label={`${dayLabel(day, true)}: ${seconds.has(day) ? (time ? `you read ${timeLabel(time).toLowerCase()}` : "you read") : "you didn’t read"}`}
                onClick={() => setPicked(picked === day ? null : day)}
                className={`flex aspect-square cursor-pointer items-center justify-center rounded-full text-ui-sm tabular-nums transition-shadow disabled:cursor-default disabled:opacity-35 ${
                  level ? `${FILL[level]} ${INK[level]} font-bold` : "hover:bg-sand-75"
                } ${picked === day ? "ring-2 ring-[var(--color-app-text)] ring-offset-2 ring-offset-[var(--reader-bg)]" : day === history.today ? "ring-1 ring-brand-500" : ""}`}
              >
                {+day.slice(8)}
              </button>
            );
          })}
        </div>

        <div className="mx-auto mt-4 flex max-w-md items-center justify-between gap-3">
          <p className="m-0 min-h-5 text-ui-sm text-[var(--color-app-text-secondary)]" aria-live="polite">
            {picked ? (
              <>
                <span className="font-bold text-[var(--color-app-text)]">{dayLabel(picked, true)}</span>
                {" · "}
                {seconds.has(picked) ? (seconds.get(picked) ? `You read ${timeLabel(seconds.get(picked)!).toLowerCase()}` : "You read") : picked === history.today ? "You haven’t read yet" : "You didn’t read"}
              </>
            ) : (
              <span className="text-[var(--color-app-text-muted)]">Pick a day to see how long you read</span>
            )}
          </p>
          <Legend />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-3">
      <dt className="text-ui-sm text-[var(--color-app-text-secondary)]">{label}</dt>
      <dd className="m-0 flex min-w-0 items-baseline gap-2">
        {sub && <span className="truncate text-ui-caption text-[var(--color-app-text-muted)]">{sub}</span>}
        <span className="font-serif text-[16px] font-semibold whitespace-nowrap tabular-nums">{value}</span>
      </dd>
    </div>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 cursor-pointer items-center justify-center rounded-sm text-[var(--color-app-text)] hover:bg-sand-75 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function Legend() {
  return (
    <div className="flex flex-none items-center gap-1 text-[10px] text-[var(--color-app-text-muted)]">
      Less
      {FILL.map((s) => (
        <span key={s} className={`size-2.5 rounded-full ${s}`} />
      ))}
      More
    </div>
  );
}

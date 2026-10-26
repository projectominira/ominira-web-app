"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SearchableAppPage from "@/app/components/shell/SearchableAppPage";
import NoResults from "@/app/components/shared/NoResults";
import { useIsAuthenticated } from "@/lib/auth/useIsAuthenticated";
import { useReadingHistory } from "@/lib/streaks/hooks";
import { dayLabel, dayNote, monthGrid, monthSummary, timeLabel, wasRead } from "@/lib/streaks/history";
import { goalLabel } from "@/lib/rooms/home";
import type { ReadingHistory } from "@/lib/streaks/types";

const EYEBROW = "text-ui-xs tracking-eyebrow uppercase";
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
/** A day's circle, its date inside, as on the streak card's week: filled
 * when the goal was met (a streak day, restored ones too),
 * filled light when read under it, an empty ring for today until it's met. */
type MarkKind = "met" | "under" | "today" | "none";
const MARK: Record<MarkKind, string> = {
  met: "bg-brand-500 font-bold text-sand-25",
  under: "bg-brand-100 text-sand-900",
  today: "border-[1.5px] border-brand-500 font-bold text-[var(--color-app-brand)]",
  none: "text-[var(--color-app-text)]",
};

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
        <div className="flex justify-center py-16">
          <div role="status" aria-label="Loading" className="size-7 animate-spin rounded-full border-[2.5px] border-sand-200 border-t-brand-500" />
        </div>
      ) : (
        // The year before stays shown while the next loads: its days aren't this month's.
        <Month key={at} history={data} at={at} loading={data.year !== Math.floor(at / 12)} onGo={setAt} />
      )}
    </SearchableAppPage>
  );
}

/** One month: its time, days, longest streak and best day, and beside them
 * every day of it, marked by whether its goal was met. */
function Month({ history, at, loading, onGo }: { history: ReadingHistory; at: number; loading: boolean; onGo: (at: number) => void }) {
  const month = (at % 12) + 1;
  const year = Math.floor(at / 12);
  const name = MONTH_NAMES[month - 1];
  const thisMonth = at === monthIndex(history.today);
  const [picked, setPicked] = useState<string | null>(null);
  const byDay = useMemo(() => new Map(loading ? [] : history.days.map((d) => [d.day, d])), [history, loading]);
  const summary = useMemo(() => monthSummary(loading ? { ...history, days: [] } : history, month), [history, loading, month]);
  const cells = monthGrid(year, month);
  const pastDays = cells.filter((d) => d && d <= history.today).length;
  const note = (day: string) => dayNote(day, byDay.get(day), history.today);

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

        <dl className="m-0 mt-6 flex flex-col divide-y divide-[var(--color-app-border)] border-t border-[var(--color-app-border)]">
          <Stat label="Your daily goal" value={goalLabel(history.goal)} />
          <Stat label="Days you met your goal" value={`${summary.goalDays} of ${pastDays}`} />
          <Stat label="Your longest streak" value={summary.longestRun ? days(summary.longestRun) : "—"} />
          <Stat label="Your best day" value={summary.bestDay ? timeLabel(summary.bestDay.seconds) : "—"} sub={summary.bestDay ? dayLabel(summary.bestDay.day) : undefined} />
        </dl>
      </div>

      <div className="flex flex-col p-4 md:p-7 md:pt-8">
        <div className={`mx-auto grid w-full max-w-lg grid-cols-7 gap-y-2 ${loading ? "animate-pulse" : ""}`}>
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="pb-2 text-center text-ui-xs font-semibold text-[var(--color-app-text-muted)]">
              {d}
            </span>
          ))}
          {cells.map((day, j) => {
            if (!day) return <span key={j} />;
            const d = byDay.get(day);
            const kind: MarkKind = d?.streak ? "met" : day === history.today ? "today" : d && wasRead(d) ? "under" : "none";
            return (
              <button
                key={day}
                type="button"
                disabled={day > history.today}
                aria-pressed={picked === day}
                aria-label={`${dayLabel(day, true)}: ${note(day)}`}
                onClick={() => setPicked(picked === day ? null : day)}
                className="group flex cursor-pointer justify-center disabled:cursor-default disabled:opacity-35"
              >
                <Mark kind={kind} picked={picked === day}>
                  {+day.slice(8)}
                </Mark>
              </button>
            );
          })}
        </div>

        {/* The picked day, the legend under it on mobile, beside it (stacked, so the sentence keeps its width) when wide. */}
        <div className="mx-auto mt-5 flex w-full max-w-lg flex-col gap-4 md:mt-auto md:flex-row md:items-end md:justify-between md:pt-5">
          {/* Room for the longest sentence, so picking a day never moves the page. */}
          <p className="m-0 min-h-16 text-ui-sm text-pretty text-[var(--color-app-text-secondary)]" aria-live="polite">
            {picked ? (
              <>
                <span className="mb-1 block font-bold text-[var(--color-app-text)]">{dayLabel(picked, true)}</span>
                {note(picked)}
              </>
            ) : (
              <span className="text-[var(--color-app-text-muted)]">Pick a day to see its reading against your goal</span>
            )}
          </p>
          <div className="flex flex-none flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-[var(--color-app-text-muted)] md:flex-col">
            <Key kind="met">Goal met</Key>
            <Key kind="under">Under goal</Key>
            <Key kind="today">Today</Key>
          </div>
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

function Mark({ kind, picked, small, children }: { kind: MarkKind; picked?: boolean; small?: boolean; children?: ReactNode }) {
  return (
    <span
      className={`flex flex-none items-center justify-center rounded-full tabular-nums transition-colors ${
        small ? "size-2.5" : `size-10 text-ui-sm md:size-11 ${kind === "none" ? "group-enabled:group-hover:bg-sand-75" : ""}`
      } ${MARK[kind]} ${picked ? "ring-2 ring-[var(--color-app-text)] ring-offset-2 ring-offset-[var(--reader-bg)]" : ""}`}
    >
      {children}
    </span>
  );
}

function Key({ kind, children }: { kind: MarkKind; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <Mark kind={kind} small />
      {children}
    </span>
  );
}

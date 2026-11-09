"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, EyeOff, X } from "lucide-react";
import { addDays, weekdayOf, type LocalDay } from "@/lib/time/zone";
import {
  dashboardHref,
  FILTER_HIDDEN_COOKIE,
  monthPeriod,
  periodLabel,
  periodOf,
  periodParam,
  shift,
  versusPhrase,
  weekPeriod,
  yearBefore,
  type Period,
  type Versus,
  type View,
} from "@/lib/metrics/period";

const CONTROL = "h-9 rounded-sm border border-sand-300 bg-[var(--reader-surface)] text-[13px] font-semibold text-[var(--reader-text)]";
const STEP =
  "inline-flex h-full w-9 flex-none items-center justify-center text-[var(--reader-text-muted)] no-underline transition-colors hover:bg-[var(--reader-surface-hover)] hover:text-[var(--reader-text)]";

/**
 * /admin's period controls: Week or Month, the period (‹ › to step, the
 * label to pick one), and what it's compared with. Every state is a URL
 * (dashboardHref), so a comparison can be bookmarked or shared. They fold
 * into one chip summarising the state; the chip unfolds them.
 */
export default function PeriodFilter({
  period,
  compare,
  vs,
  today,
  hidden: hiddenAtLoad = false,
}: {
  period: Period;
  compare: Period;
  vs: Versus;
  today: LocalDay;
  hidden?: boolean;
}) {
  const router = useRouter();
  const [hidden, setHiddenState] = useState(hiddenAtLoad);
  const setHidden = (h: boolean) => {
    setHiddenState(h);
    setOpen(null);
    document.cookie = `${FILTER_HIDDEN_COOKIE}=${h ? "1" : ""}; path=/admin; max-age=${h ? 31536000 : 0}; samesite=lax`;
  };
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<"period" | "compare" | "pick-compare" | null>(null);
  const current = periodOf(period.view, today);
  const go = (p: Period, v: Versus) => {
    setOpen(null);
    startTransition(() => router.push(dashboardHref(p, v, periodOf(p.view, today))));
  };
  const href = (p: Period, v: Versus = vs) => dashboardHref(p, v, periodOf(p.view, today));

  // Switching keeps roughly the same place: the month a week's Thursday is
  // in; a month's current week, or the week of its 4th.
  const switchTo = (view: View): Period => {
    if (view === "month") return periodOf("month", addDays(period.start, 3));
    const day = addDays(period.start, 3);
    return periodOf("week", day > today ? today : day);
  };

  const next = shift(period, 1);
  const prevLabel = `Previous ${period.view}`;
  const isYear = vs === "year";
  const isNone = vs === "none";
  const isPicked = vs !== "prev" && !isYear && !isNone;

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        aria-expanded={false}
        title="Show date filter"
        className={`${CONTROL} inline-flex cursor-pointer items-center gap-2 px-3 whitespace-nowrap hover:bg-[var(--reader-surface-hover)]`}
      >
        <CalendarDays size={14} className="text-[var(--reader-text-muted)]" />
        {periodLabel(period, true)}
        {!isNone && <span className="font-medium text-[var(--reader-text-muted)]">· vs {versusPhrase(period, vs, compare).replace(/^in /, "")}</span>}
      </button>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 transition-opacity ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <div role="group" aria-label="View" className={`${CONTROL} flex overflow-hidden p-0.5`}>
        {(["week", "month"] as const).map((view) => {
          const active = view === period.view;
          return (
            <Link
              key={view}
              href={href(switchTo(view), isYear || isNone ? vs : "prev")}
              aria-current={active ? "true" : undefined}
              className={`inline-flex items-center rounded-[3px] px-3 no-underline transition-colors ${
                active ? "bg-[var(--reader-surface-hover)] text-[var(--reader-text)]" : "text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]"
              }`}
            >
              {view === "week" ? "Week" : "Month"}
            </Link>
          );
        })}
      </div>

      <div className={`${CONTROL} relative flex items-stretch`}>
        <Link href={href(shift(period, -1))} aria-label={prevLabel} className={`${STEP} rounded-l-sm border-r border-sand-300`}>
          <ChevronLeft size={16} />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(open === "period" ? null : "period")}
          aria-haspopup="dialog"
          aria-expanded={open === "period"}
          className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 border-none bg-transparent px-3 text-[13px] font-semibold whitespace-nowrap text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]"
        >
          {periodLabel(period)}
          <ChevronDown size={14} className="text-[var(--reader-text-subtle)]" />
        </button>
        {next.start <= today ? (
          <Link href={href(next)} aria-label={`Next ${period.view}`} className={`${STEP} rounded-r-sm border-l border-sand-300`}>
            <ChevronRight size={16} />
          </Link>
        ) : (
          <span aria-label={`Next ${period.view}`} aria-disabled="true" className={`${STEP} rounded-r-sm border-l border-sand-300 opacity-40 hover:bg-transparent`}>
            <ChevronRight size={16} />
          </span>
        )}
        {open === "period" && (
          <Popover onClose={() => setOpen(null)}>
            <PeriodPicker view={period.view} selected={period} today={today} onPick={(p) => go(p, vs)} />
            {periodParam(period) !== periodParam(current) && (
              <button type="button" onClick={() => go(current, vs)} className="mt-2 w-full cursor-pointer rounded-sm border-none bg-transparent py-1.5 text-[12px] font-semibold text-brand-500 hover:bg-[var(--reader-surface-hover)]">
                Back to this {period.view}
              </button>
            )}
          </Popover>
        )}
      </div>

      <div className={`${CONTROL} relative flex items-stretch`}>
        <button
          type="button"
          onClick={() => setOpen(open ? null : "compare")}
          aria-haspopup="menu"
          aria-expanded={open === "compare" || open === "pick-compare"}
          className={`inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent px-3 text-[13px] font-semibold whitespace-nowrap text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)] ${isNone ? "rounded-sm" : "rounded-l-sm"}`}
        >
          {isNone ? (
            "Compare"
          ) : (
            <>
              <span className="font-medium text-[var(--reader-text-muted)]">vs</span>
              {versusPhrase(period, vs, compare).replace(/^in /, "")}
            </>
          )}
          <ChevronDown size={14} className="text-[var(--reader-text-subtle)]" />
        </button>
        {!isNone && (
          <Link href={href(period, "none")} aria-label="Clear comparison" title="Clear comparison" className={`${STEP} rounded-r-sm border-l border-sand-300`}>
            <X size={14} />
          </Link>
        )}
        {open === "compare" && (
          <Popover onClose={() => setOpen(null)} menu>
            <MenuItem checked={vs === "prev"} onClick={() => go(period, "prev")}>
              {prevLabel}
              <Hint>{periodLabel(shift(period, -1), true)}</Hint>
            </MenuItem>
            <MenuItem checked={isYear} onClick={() => go(period, "year")}>
              Same {period.view} last year
              <Hint>{periodLabel(yearBefore(period), period.view === "month")}</Hint>
            </MenuItem>
            <div role="separator" className="mx-2 my-1 h-px bg-[var(--reader-border)]" />
            <MenuItem checked={isPicked} onClick={() => setOpen("pick-compare")}>
              Pick a {period.view}…{isPicked && <Hint>{periodLabel(compare, true)}</Hint>}
            </MenuItem>
          </Popover>
        )}
        {open === "pick-compare" && (
          <Popover onClose={() => setOpen(null)}>
            <PeriodPicker view={period.view} selected={compare} today={today} onPick={(p) => go(period, periodParam(p))} />
          </Popover>
        )}
      </div>

      <button
        type="button"
        onClick={() => setHidden(true)}
        aria-expanded={true}
        aria-label="Hide date filter"
        title="Hide date filter"
        className={`${CONTROL} inline-flex w-9 cursor-pointer items-center justify-center text-[var(--reader-text-muted)] hover:bg-[var(--reader-surface-hover)] hover:text-[var(--reader-text)]`}
      >
        <EyeOff size={15} />
      </button>
    </div>
  );
}

function Popover({ onClose, menu, children }: { onClose: () => void; menu?: boolean; children: ReactNode }) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-30" aria-hidden />
      <div
        role={menu ? "menu" : "dialog"}
        className={`reader-menu-in absolute top-[calc(100%+6px)] left-0 z-40 sm:right-0 sm:left-auto rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)] shadow-md ${
          menu ? "flex w-[300px] flex-col p-1" : "w-[272px] p-3"
        }`}
      >
        {children}
      </div>
    </>
  );
}

function MenuItem({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      onClick={onClick}
      className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-sm border-none bg-transparent px-2.5 text-left text-[12px] font-semibold whitespace-nowrap text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]"
    >
      <span className="flex w-4 flex-none justify-center text-brand-500">{checked && <Check size={14} />}</span>
      {children}
    </button>
  );
}

const Hint = ({ children }: { children: ReactNode }) => <span className="ml-auto pl-3 font-medium whitespace-nowrap text-[var(--reader-text-subtle)]">{children}</span>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthTitle = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" });

/** A month calendar whose rows are weeks, or a year's months; periods not
 * yet begun are disabled. */
function PeriodPicker({ view, selected, today, onPick }: { view: View; selected: Period; today: LocalDay; onPick: (p: Period) => void }) {
  // The page shown: a month (weeks) or a year (months), from the selection.
  const [page, setPage] = useState(() => (view === "week" ? monthPeriod(+addDays(selected.start, 3).slice(0, 4), +addDays(selected.start, 3).slice(5, 7)) : monthPeriod(+selected.start.slice(0, 4), 1)));
  const step = view === "week" ? 1 : 12;
  const canNext = shift(page, step).start <= today;
  const title = view === "week" ? monthTitle.format(new Date(`${page.start}T00:00:00Z`)) : page.start.slice(0, 4);

  const header = (
    <div className="mb-2 flex items-center justify-between">
      <PageStep label={`Previous ${view === "week" ? "month" : "year"}`} onClick={() => setPage(shift(page, -step))} icon={<ChevronLeft size={16} />} />
      <span className="text-[13px] font-bold text-[var(--reader-text)]">{title}</span>
      <PageStep label={`Next ${view === "week" ? "month" : "year"}`} onClick={canNext ? () => setPage(shift(page, step)) : undefined} icon={<ChevronRight size={16} />} />
    </div>
  );

  if (view === "month") {
    const year = +page.start.slice(0, 4);
    return (
      <div>
        {header}
        <div className="grid grid-cols-3 gap-1">
          {MONTHS.map((name, i) => {
            const p = monthPeriod(year, i + 1);
            const active = p.start === selected.start;
            const future = p.start > today;
            return (
              <button
                key={name}
                type="button"
                disabled={future}
                onClick={() => onPick(p)}
                className={`h-9 cursor-pointer rounded-sm border-none text-[13px] font-semibold transition-colors disabled:cursor-default disabled:opacity-35 ${
                  active ? "bg-brand-500 text-white" : "bg-transparent text-[var(--reader-text)] enabled:hover:bg-[var(--reader-surface-hover)]"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const last = addDays(page.start, page.days - 1);
  const weeks: LocalDay[] = [];
  for (let monday = addDays(page.start, -weekdayOf(page.start)); monday <= last; monday = addDays(monday, 7)) weeks.push(monday);
  const month = page.start.slice(0, 7);

  return (
    <div>
      {header}
      <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-semibold text-[var(--reader-text-subtle)]">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="flex flex-col gap-0.5">
        {weeks.map((monday) => {
          const active = monday === selected.start;
          const future = monday > today;
          return (
            <button
              key={monday}
              type="button"
              disabled={future}
              onClick={() => onPick(weekPeriod(monday))}
              aria-label={periodLabel(weekPeriod(monday))}
              className={`grid h-8 cursor-pointer grid-cols-7 rounded-sm border-none text-[12px] font-semibold tabular-nums transition-colors disabled:cursor-default disabled:opacity-35 ${
                active ? "bg-brand-500 text-white" : "bg-transparent text-[var(--reader-text)] enabled:hover:bg-[var(--reader-surface-hover)]"
              }`}
            >
              {Array.from({ length: 7 }, (_, i) => {
                const day = addDays(monday, i);
                const outside = day.slice(0, 7) !== month;
                return (
                  <span key={day} className={`flex items-center justify-center ${outside && !active ? "text-[var(--reader-text-subtle)]" : ""} ${day === today ? "underline underline-offset-4" : ""}`}>
                    {+day.slice(8)}
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PageStep({ label, onClick, icon }: { label: string; onClick?: () => void; icon: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={label}
      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent text-[var(--reader-text-muted)] hover:bg-[var(--reader-surface-hover)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {icon}
    </button>
  );
}

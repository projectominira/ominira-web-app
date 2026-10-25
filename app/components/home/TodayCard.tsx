"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronRight, Headphones, Minus, Plus, Target } from "lucide-react";
import ReaderLink from "@/app/components/ReaderLink";
import Tooltip from "@/app/components/reader/Tooltip";
import BookCover from "@/app/components/shared/BookCover";
import ReadingProgress from "@/app/components/shared/ReadingProgress";
import type { MaterialSummary } from "@/lib/api/types";
import { resolveBookCoverSrc } from "@/lib/materials/image";
import { GOAL, GOAL_STOPS, goalIndex, goalLabel, goalShare, goalShort, goalStep, ringTime, streakCopy, weekChain } from "@/lib/rooms/home";
import { dayLabel } from "@/lib/streaks/history";
import type { CurrentBook, StreakToday } from "@/lib/rooms/types";
import type { StreakView } from "@/lib/streaks/types";
import { ModeIcon, RESUME, SWITCH } from "@/app/components/rooms/RoomHeader";

const EYEBROW = "text-ui-xs tracking-eyebrow uppercase";
const R = 43;
const CIRC = 2 * Math.PI * R;

/**
 * Today (home-spec §2 Home 2): the book you're reading (or, for a new
 * reader, the first Featured book as "Start here"), and today's reading —
 * the ring, the streak, the week, the goal and History. A card each,
 * stacked. Signed out, the book only.
 */
export default function TodayCard({
  current,
  start,
  streak,
  today,
  desktop = false,
  onSaveGoal,
}: {
  current: CurrentBook | null;
  /** A new reader's first book: the first Featured. */
  start: MaterialSummary | null;
  streak: StreakView | null;
  today: StreakToday | null;
  desktop?: boolean;
  onSaveGoal?: (goal: number) => void;
}) {
  const book = current?.material ?? start;
  const card = "overflow-hidden rounded-sm border border-[var(--color-app-border)] bg-[var(--reader-bg)] text-[var(--color-app-text)]";
  const reading = streak && today;
  // A card each, stacked: the book, then today's reading.
  return (
    <div className={`flex flex-col ${desktop ? "gap-6" : "gap-4"}`}>
      {book && (
        <div className={card}>
          <BookHalf book={book} current={current} desktop={desktop} />
        </div>
      )}
      {reading && (
        <div className={card}>
          <ReadingHalf streak={streak} today={today} desktop={desktop} onSaveGoal={onSaveGoal} />
        </div>
      )}
    </div>
  );
}

/**
 * The book (the book page's resume, MaterialDetailView): one primary action
 * that follows how the reader left off — Continue listening when they last
 * listened, as the Shelf tells — and a quiet icon to switch to the other.
 */
function BookHalf({ book, current, desktop }: { book: MaterialSummary; current: CurrentBook | null; desktop: boolean }) {
  const listening = current?.listening ?? false;
  const readHref = current?.readHref ?? `/read/${book.slug}`;
  const listenHref = current?.listenHref ?? `/read/${book.slug}?listen=1`;
  const cta = !current ? "Start reading" : listening ? "Continue listening" : "Continue reading";
  const other = listening ? "Switch to reading" : "Listen";
  return (
    <div className={`flex h-full min-w-0 flex-col justify-between gap-4 ${desktop ? "p-5" : "p-4"}`}>
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <ReaderLink href={listening ? listenHref : readHref} aria-label={`Open ${book.title}`} className="w-16 flex-none">
          <BookCover src={resolveBookCoverSrc(book)} alt="" className="aspect-2/3 w-16 rounded-xs ring-1 ring-sand-950/8" />
        </ReaderLink>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className={`flex items-center gap-1.5 ${EYEBROW} ${current ? "text-[var(--color-app-text-muted)]" : "text-[var(--color-app-brand)]"}`}>
            {listening && <Headphones size={12} strokeWidth={2} aria-hidden />}
            {current ? (listening ? "Listening now" : "Reading now") : "Start here"}
          </div>
          <div className="line-clamp-2 font-serif text-[19px]/[1.25] font-semibold">{book.title}</div>
          {current ? (
            <ReadingProgress chapter={current.chapter} pct={current.pct} />
          ) : (
            <div className="truncate text-ui-caption text-[var(--color-app-text-secondary)]">{`${book.author ? `${book.author} · ` : ""}Featured this week`}</div>
          )}
        </div>
      </div>
      <div className="flex flex-none items-center gap-2">
        <ReaderLink href={listening ? listenHref : readHref} className={`${RESUME} flex-1 px-6 py-2.5`}>
          <ModeIcon listening={listening} size={16} />
          {cta}
        </ReaderLink>
        <Tooltip label={other}>
          <ReaderLink href={listening ? readHref : listenHref} aria-label={other} className={`${SWITCH} p-2.5`}>
            <ModeIcon listening={!listening} size={18} />
          </ReaderLink>
        </Tooltip>
      </div>
    </div>
  );
}

/** Today's minutes against the goal, round. */
function Ring({ minutes, goal }: { minutes: number; goal: number }) {
  const share = goalShare({ minutes, goal });
  const { value, unit } = ringTime(minutes);
  return (
    <div className="relative size-24 flex-none">
      <svg aria-hidden width="96" height="96" viewBox="0 0 96 96" className="block -rotate-90">
        <circle cx="48" cy="48" r={R} fill="none" strokeWidth="5" className="stroke-sand-100" />
        <circle
          cx="48"
          cy="48"
          r={R}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(CIRC * share).toFixed(1)} ${CIRC.toFixed(1)}`}
          className="stroke-brand-500 transition-[stroke-dasharray] duration-300 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
        <span className="font-serif text-[22px]/none font-semibold">{value}</span>
        <span className="font-sans text-[10px]/none font-medium text-[var(--color-app-text-secondary)]">{unit}</span>
      </span>
    </div>
  );
}

/** The card's footer: two actions split by a hairline. */
export const FOOT = "flex h-11 min-w-0 cursor-pointer items-center justify-center gap-1.5 px-3 text-ui-sm transition-colors hover:bg-sand-75";

export function Footer({ children }: { children: ReactNode }) {
  return <div className="mt-auto grid grid-cols-2 divide-x divide-[var(--color-app-border)] border-t border-[var(--color-app-border)]">{children}</div>;
}

/** This week, a day a column: the letter over a mark, ticked when read. */
function Week({ streak }: { streak: StreakView }) {
  return (
    <ol aria-label="This week" className="m-0 grid list-none grid-cols-7 gap-1 p-0">
      {weekChain(streak).map((d) => (
        <li key={d.day} className="flex flex-col items-center gap-1.5">
          <span className={`text-[11px]/none font-semibold ${d.state === "today" ? "text-[var(--color-app-brand)]" : "text-[var(--color-app-text-muted)]"}`}>{d.letter}</span>
          <span
            aria-label={`${dayLabel(d.day, true)}: ${d.state === "done" ? "read" : d.state === "today" ? "today" : "not read"}`}
            className={`flex size-7 items-center justify-center rounded-full ${
              d.state === "done"
                ? "bg-brand-500 text-sand-25"
                : d.state === "today"
                  ? "border-[1.5px] border-brand-500"
                  : "border border-dashed border-sand-300"
            }`}
          >
            {d.state === "done" && <Check size={14} strokeWidth={2.75} aria-hidden />}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function StepButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border border-sand-300 text-[var(--color-app-text)] transition-colors hover:bg-sand-75 active:bg-sand-100 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

/** Today's reading: the ring and the streak, the week, then Goal and
 * History. Goal turns the card into a stepper (a stop a tap), a slider
 * (1 min to 8 hr), with Cancel and Save. */
function ReadingHalf({
  streak,
  today,
  desktop,
  onSaveGoal,
}: {
  streak: StreakView;
  today: StreakToday;
  desktop: boolean;
  onSaveGoal?: (goal: number) => void;
}) {
  // The draft while adjusting; a goal set before the range shows at its nearest end.
  const [draft, setDraft] = useState<number | null>(null);
  const pad = desktop ? "p-5" : "p-4";

  if (draft !== null)
    return (
      <div className="flex h-full min-w-0 flex-col">
        <div className={`flex flex-col gap-4 ${pad}`}>
          <div className="flex items-baseline justify-between gap-3">
            <div className={`${EYEBROW} text-[var(--color-app-text-muted)]`}>Daily goal</div>
            <div className="text-ui-caption text-[var(--color-app-text-secondary)]">{draft === today.goal ? `Today: ${goalShort(today.minutes)}` : "Not saved yet"}</div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <StepButton label="Shorter goal" disabled={draft <= GOAL.min} onClick={() => setDraft(goalStep(draft, -1))}>
              <Minus size={18} strokeWidth={2} aria-hidden />
            </StepButton>
            <div className="flex min-w-0 flex-col items-center gap-1.5 text-center" aria-live="polite">
              <span aria-label={goalLabel(draft)} className="font-serif text-[26px]/[1.15] font-semibold whitespace-nowrap tabular-nums">{goalShort(draft)}</span>
              <span className="text-ui-caption text-[var(--color-app-text-secondary)]">a day</span>
            </div>
            <StepButton label="Longer goal" disabled={draft >= GOAL.max} onClick={() => setDraft(goalStep(draft, 1))}>
              <Plus size={18} strokeWidth={2} aria-hidden />
            </StepButton>
          </div>
          <input
            type="range"
            aria-label="Daily goal"
            aria-valuetext={goalLabel(draft)}
            min={0}
            max={GOAL_STOPS.length - 1}
            value={goalIndex(draft)}
            onChange={(e) => setDraft(GOAL_STOPS[Number(e.target.value)])}
            className="h-6 w-full cursor-pointer accent-brand-500"
          />
        </div>
        <Footer>
          <button type="button" onClick={() => setDraft(null)} className={FOOT}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (draft !== today.goal) onSaveGoal?.(draft);
              setDraft(null);
            }}
            className={`${FOOT} font-bold text-[var(--color-app-brand)]`}
          >
            Save
          </button>
        </Footer>
      </div>
    );

  const copy = streakCopy(streak, today);
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className={`flex flex-col gap-5 ${pad}`}>
        <div className="flex items-center gap-4">
          <Ring minutes={today.minutes} goal={today.goal} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className={`${EYEBROW} text-[var(--color-app-text-muted)]`}>Daily reading</div>
            <div className="font-serif text-[21px]/[1.25] font-semibold">{copy.title}</div>
            <div className="text-ui-caption text-pretty text-[var(--color-app-text-secondary)]">{copy.sub}</div>
          </div>
        </div>
        <Week streak={streak} />
      </div>
      <Footer>
        <button type="button" onClick={() => setDraft(goalStep(today.goal))} aria-label={`Daily goal, ${goalLabel(today.goal)}. Adjust`} className={FOOT}>
          <Target size={15} strokeWidth={1.75} aria-hidden className="flex-none text-[var(--color-app-text-muted)]" />
          <span className="text-[var(--color-app-text-secondary)]">Goal</span>
          <span className="truncate font-bold">{goalLabel(today.goal)}</span>
        </button>
        <Link href="/history" className={`${FOOT} font-bold text-[var(--color-app-brand)]`}>
          History
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
        </Link>
      </Footer>
    </div>
  );
}

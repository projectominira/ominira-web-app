"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { BookOpen, ChevronRight, Headphones, Play } from "lucide-react";
import ReaderLink from "@/app/components/ReaderLink";
import Tooltip from "@/app/components/reader/Tooltip";
import BookCover from "@/app/components/shared/BookCover";
import type { MaterialSummary } from "@/lib/api/types";
import { resolveBookCoverSrc } from "@/lib/materials/image";
import { GOAL, goalAt, goalFrom, goalLabel, goalShare, streakCopy, weekChain } from "@/lib/rooms/home";
import type { CurrentBook, StreakToday } from "@/lib/rooms/types";
import type { StreakView } from "@/lib/streaks/types";
import { button } from "./buttons";

const EYEBROW = "text-ui-xs tracking-eyebrow uppercase";
const R = 33;
const CIRC = 2 * Math.PI * R;

/**
 * Today (home-spec §2 Home 2): the book you're reading (or, for a new
 * reader, the first Featured book as "Start here"), and today's reading —
 * the ring, the streak, the week and Adjust daily goal. Stacked; on desktop
 * each half is a row. Signed out, the book half only.
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
  const card = "rounded-sm border border-[var(--color-app-border)] bg-[var(--reader-bg)] text-[var(--color-app-text)]";
  const reading = streak && today;
  // Desktop: the book and today's reading, a card each, stacked in the side column.
  if (desktop)
    return (
      <div className="flex flex-col gap-6">
        {book && (
          <div className={card}>
            <BookHalf book={book} current={current} desktop />
          </div>
        )}
        {reading && (
          <div className={card}>
            <ReadingHalf streak={streak} today={today} desktop onSaveGoal={onSaveGoal} className="" />
          </div>
        )}
      </div>
    );
  return (
    <div className={`flex flex-col ${card}`}>
      {book && <BookHalf book={book} current={current} desktop={false} />}
      {reading && <ReadingHalf streak={streak} today={today} desktop={false} onSaveGoal={onSaveGoal} className={book ? "border-t border-[var(--color-app-border)]" : ""} />}
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
            {current ? `Left off ${listening ? "listening" : "reading"}` : "Start here"}
          </div>
          <div className="line-clamp-2 font-serif text-[19px]/[1.25] font-semibold">{book.title}</div>
          <div className="truncate text-ui-caption text-[var(--color-app-text-secondary)]">
            {current ? current.chapter : `${book.author ? `${book.author} · ` : ""}Featured this week`}
          </div>
          {current && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-sand-100">
                <span style={{ width: `${current.pct}%` }} className="block h-full rounded-full bg-brand-500" />
              </span>
              <span className="flex-none text-ui-caption text-[var(--color-app-text-secondary)]">{current.pct}% complete</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-none items-center gap-2">
        <ReaderLink href={listening ? listenHref : readHref} className={`${button("primary")} min-h-12 flex-1 px-6`}>
          {listening && <Play size={16} aria-hidden />}
          {cta}
        </ReaderLink>
        <Tooltip label={other}>
          <ReaderLink href={listening ? readHref : listenHref} aria-label={other} className="flex size-12 flex-none items-center justify-center rounded-sm border border-sand-300 text-[var(--color-app-text)] transition-colors hover:bg-sand-75">
            {listening ? <BookOpen size={18} aria-hidden /> : <Headphones size={18} aria-hidden />}
          </ReaderLink>
        </Tooltip>
      </div>
    </div>
  );
}

/** Today's minutes against the goal, round. */
function Ring({ minutes, goal }: { minutes: number; goal: number }) {
  const share = goalShare({ minutes, goal });
  return (
    <div className="relative size-19 flex-none">
      <svg aria-hidden width="76" height="76" viewBox="0 0 76 76" className="block -rotate-90">
        <circle cx="38" cy="38" r={R} fill="none" strokeWidth="5" className="stroke-sand-100" />
        <circle
          cx="38"
          cy="38"
          r={R}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(CIRC * share).toFixed(1)} ${CIRC.toFixed(1)}`}
          className="stroke-brand-500 transition-[stroke-dasharray] duration-300 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-[22px]/none font-semibold">{minutes}</span>
        <span className="mt-0.5 font-sans text-[10px]/[1.2] font-medium text-[var(--color-app-text-secondary)]">of {goal} min</span>
      </span>
    </div>
  );
}

/** The goal's slider, 30 min to 8 hr: drag, or the arrow keys a quarter hour at a time. */
function GoalSlider({ goal, onGoal }: { goal: number; onGoal: (m: number) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const at = (x: number) => {
    const r = track.current!.getBoundingClientRect();
    onGoal(goalFrom((x - r.left) / r.width));
  };
  const pct = `${(goalAt(goal) * 100).toFixed(1)}%`;
  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Daily goal"
        aria-valuemin={GOAL.min}
        aria-valuemax={GOAL.max}
        aria-valuenow={goal}
        aria-valuetext={goalLabel(goal)}
        onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragging.current = true;
          at(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && at(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onKeyDown={(e: KeyboardEvent) => {
          const d = { ArrowRight: GOAL.step, ArrowUp: GOAL.step, ArrowLeft: -GOAL.step, ArrowDown: -GOAL.step }[e.key];
          if (!d) return;
          e.preventDefault();
          onGoal(Math.min(GOAL.max, Math.max(GOAL.min, goal + d)));
        }}
        className="relative h-11 cursor-pointer touch-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <span className="absolute inset-x-0 top-4.75 h-1.5 rounded-full bg-sand-100" />
        <span style={{ width: pct }} className="absolute top-4.75 left-0 h-1.5 rounded-full bg-brand-500" />
        <span style={{ left: pct }} className="absolute top-2 -ml-3.5 size-7 rounded-full border-2 border-brand-500 bg-[var(--reader-bg)] shadow-sm" />
      </div>
      <div className="flex justify-between text-ui-caption text-[var(--color-app-text-muted)]">
        <span>{goalLabel(GOAL.min)}</span>
        <span>{goalLabel(GOAL.max)}</span>
      </div>
    </div>
  );
}

/** Today's reading; Adjust daily goal turns it into the goal's slider,
 * with Cancel and Save. */
function ReadingHalf({
  streak,
  today,
  desktop,
  onSaveGoal,
  className,
}: {
  streak: StreakView;
  today: StreakToday;
  desktop: boolean;
  onSaveGoal?: (goal: number) => void;
  className: string;
}) {
  // The draft while adjusting; a goal set before the slider's range shows at its nearest end.
  const [draft, setDraft] = useState<number | null>(null);
  const copy = streakCopy(streak, today);
  const { days, linked } = weekChain(streak);

  if (draft !== null)
    return (
      <div className={`flex min-w-0 flex-col gap-4 ${desktop ? "p-5" : "p-4"} ${className}`}>
        <div className={`flex gap-4 ${desktop ? "items-center" : "flex-col items-center text-center"}`}>
          <Ring minutes={today.minutes} goal={draft} />
          <div className={`flex min-w-0 flex-col gap-1 ${desktop ? "" : "items-center"}`}>
            <div className={`${EYEBROW} text-[var(--color-app-text-muted)]`}>Daily goal</div>
            <div className="font-serif text-[21px]/[1.25] font-semibold">{goalLabel(draft)} a day</div>
            <div className="text-ui-caption text-[var(--color-app-text-secondary)]">
              {draft === today.goal ? `Drag to set. Default is ${goalLabel(GOAL.fallback)}.` : "Not saved yet"}
            </div>
          </div>
        </div>
        <GoalSlider goal={draft} onGoal={setDraft} />
        <div className={desktop ? "flex justify-end gap-2" : "grid grid-cols-2 gap-2"}>
          <button type="button" onClick={() => setDraft(null)} className={button("secondary", { full: !desktop })}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (draft !== today.goal) onSaveGoal?.(draft);
              setDraft(null);
            }}
            className={button("primary", { full: !desktop })}
          >
            Save
          </button>
        </div>
      </div>
    );

  const text = (
    <div className={`flex min-w-0 flex-col gap-1 ${desktop ? "flex-1 items-start text-left" : "items-center"}`}>
      <div className={`${EYEBROW} whitespace-nowrap text-[var(--color-app-text-muted)]`}>Today’s reading</div>
      <div className="font-serif text-[21px]/[1.25] font-semibold">{copy.title}</div>
      <div className="max-w-70 text-ui-caption text-pretty text-[var(--color-app-text-secondary)]">{copy.sub}</div>
    </div>
  );
  const adjust = (
    <button
      type="button"
      onClick={() => setDraft(Math.min(GOAL.max, Math.max(GOAL.min, today.goal)))}
      className="flex min-h-9 cursor-pointer items-center gap-0.5 rounded-sm px-2 text-ui-sm font-bold whitespace-nowrap text-[var(--color-app-brand)] hover:bg-brand-50"
    >
      Adjust daily goal
      <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
    </button>
  );
  const week = (
    <div aria-label="This week" className="flex w-full max-w-64 items-center">
      {days.map((d, i) => (
        <span key={d.day} className="contents">
          {i > 0 && <span className={`h-[1.5px] max-w-3.5 min-w-1 flex-1 ${linked[i] && d.state === "done" ? "bg-brand-500" : "bg-[var(--color-app-border)]"}`} />}
          <span
            title={d.state === "today" ? "Today" : undefined}
            className={`flex size-7.5 flex-none items-center justify-center rounded-full font-sans text-[11px]/none font-bold ${
              d.state === "done"
                ? "border-[1.5px] border-brand-500 bg-brand-500 text-sand-25"
                : d.state === "today"
                  ? "border-[1.5px] border-brand-500 bg-[var(--reader-bg)] text-[var(--color-app-brand)]"
                  : "border border-sand-300 bg-[var(--reader-bg)] text-[var(--color-app-text-secondary)]"
            }`}
          >
            {d.letter}
          </span>
        </span>
      ))}
    </div>
  );

  // Desktop: the ring and the streak, then the week beside Adjust daily goal.
  if (desktop)
    return (
      <div className={`flex h-full min-w-0 flex-col justify-between gap-4 p-5 ${className}`}>
        <div className="flex items-center gap-5">
          <Ring minutes={today.minutes} goal={today.goal} />
          {text}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {week}
          {adjust}
        </div>
      </div>
    );

  return (
    <div className={`flex min-w-0 flex-col items-center gap-3 p-4 text-center ${className}`}>
      <Ring minutes={today.minutes} goal={today.goal} />
      {text}
      {adjust}
      {week}
    </div>
  );
}

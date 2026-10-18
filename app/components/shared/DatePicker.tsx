"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import BottomSheet from "@/app/components/shared/BottomSheet";
import { addMonths, monthGrid, sameMonth } from "@/lib/time/calendar";
import { formatDay, formatDayRange } from "@/lib/time/format";
import { addDays, deviceTimeZone, localDay, type LocalDay } from "@/lib/time/zone";

// The date picker (studygroup-spec C4, sheet 8.1–8.2): one month at a time,
// Monday first. Today has a ring, the chosen day is filled, past days are
// muted, for a range the days between are tinted, and session days carry a
// dot. Used for book dates (M9) and session days (M8).

export type DayRange = { start: LocalDay | null; end: LocalDay | null };

const today = () => localDay(Date.now(), deviceTimeZone());

// The weekday header, from a known Monday (5 Oct 2026) in the viewer's locale.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => addDays("2026-10-05", i));

/** `marks`: days with a dot under them (the group's session days). */
function MonthPicker({ range, onPick, marks }: { range: DayRange; onPick: (day: LocalDay) => void; marks?: LocalDay[] }) {
  const now = today();
  const [month, setMonth] = useState(() => addMonths(range.start ?? now, 0));
  const { start, end } = range;

  const navButton =
    "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[var(--reader-border)] bg-transparent text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))} className={navButton}>
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-xl font-semibold text-[var(--reader-text)]" aria-live="polite">
          {formatDay(month, "month")}
        </span>
        <button type="button" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))} className={navButton}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div role="grid" className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-1.5 text-[11px] font-semibold text-[var(--reader-text-muted)]">
            {formatDay(d, "weekdayShort")}
          </span>
        ))}
        {monthGrid(month).map((day) => {
          if (!sameMonth(day, month)) return <span key={day} />;
          const chosen = day === start || day === end;
          const between = !!start && !!end && day > start && day < end;
          const tone = chosen
            ? "bg-brand-500 font-bold text-white"
            : `bg-transparent hover:bg-[var(--reader-surface-hover)] ${
                day === now
                  ? "border-[1.5px] border-solid border-[var(--reader-text-muted)] font-bold text-[var(--reader-text)]"
                  : day < now
                    ? "text-[var(--reader-text-subtle)]"
                    : "text-[var(--reader-text)]"
              }`;
          return (
            <span key={day} className={between ? "bg-brand-500/10" : undefined}>
              <button
                type="button"
                aria-pressed={chosen}
                aria-label={formatDay(day, "dayLong")}
                onClick={() => onPick(day)}
                className={`relative box-border h-11 w-11 cursor-pointer rounded-full border-0 text-sm ${tone}`}
              >
                {+day.slice(8)}
                {marks?.includes(day) && (
                  <span
                    aria-hidden
                    className={`absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${chosen ? "bg-white" : "bg-brand-500"}`}
                  />
                )}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function rangeLabel({ start, end }: DayRange): string {
  if (start && end) return start === end ? formatDay(start, "dayLong") : formatDayRange(start, end);
  if (start) return `From ${formatDay(start, "dayLong")}`;
  return "No dates";
}

const doneButton =
  "h-9 cursor-pointer rounded-sm border-none bg-brand-500 px-4 text-[13px] font-bold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60";
const clearButton =
  "h-9 cursor-pointer rounded-sm border border-[var(--reader-border)] bg-transparent px-4 text-[13px] font-bold text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]";

/** Pick a start and an end: the first tap starts the range, the next ends
 * it (or restarts it, if it's earlier). Clear sets no dates. */
export function DateRangeSheet({
  title,
  initial,
  marks,
  onDone,
  onClose,
}: {
  title: string;
  initial: DayRange;
  marks?: LocalDay[];
  onDone: (range: DayRange) => void;
  onClose: () => void;
}) {
  const [range, setRange] = useState(initial);
  const pick = (day: LocalDay) =>
    setRange(({ start, end }) => (!start || end || day < start ? { start: day, end: null } : { start, end: day }));

  return (
    <BottomSheet
      title={title}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[11px] text-[var(--reader-text-muted)]">Selected</span>
            <span className="truncate text-sm font-semibold text-[var(--reader-text)]">{rangeLabel(range)}</span>
          </span>
          <span className="flex flex-none gap-2">
            {(range.start || range.end) && (
              <button type="button" onClick={() => setRange({ start: null, end: null })} className={clearButton}>
                Clear
              </button>
            )}
            <button type="button" onClick={() => onDone(range)} className={doneButton}>
              Done
            </button>
          </span>
        </div>
      }
    >
      <MonthPicker range={range} onPick={pick} marks={marks} />
    </BottomSheet>
  );
}

/** A form field showing one day; tapping it opens the picker. */
export function DateField({
  label,
  value,
  onChange,
  marks,
  placeholder = "Pick a day",
}: {
  label: string;
  value: LocalDay | null;
  onChange: (day: LocalDay) => void;
  marks?: LocalDay[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(value);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPicked(value);
          setOpen(true);
        }}
        className="flex w-full cursor-pointer flex-col gap-1.5 border-none bg-transparent p-0 text-left text-xs font-semibold text-[var(--reader-text-muted)]"
      >
        {label}
        <span className="box-border flex w-full items-center gap-2 rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)] px-3 py-2.5 text-sm font-medium text-[var(--reader-text)]">
          <CalendarDays size={16} className="text-[var(--reader-text-muted)]" />
          {value ? formatDay(value, "dayLong") : <span className="text-[var(--reader-text-subtle)]">{placeholder}</span>}
        </span>
      </button>
      {open && (
        <BottomSheet
          title={label}
          onClose={() => setOpen(false)}
          footer={
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[11px] text-[var(--reader-text-muted)]">Selected</span>
                <span className="truncate text-sm font-semibold text-[var(--reader-text)]">
                  {picked ? formatDay(picked, "dayLong") : "No day"}
                </span>
              </span>
              <button
                type="button"
                disabled={!picked}
                onClick={() => {
                  if (picked) onChange(picked);
                  setOpen(false);
                }}
                className={doneButton}
              >
                Done
              </button>
            </div>
          }
        >
          <MonthPicker range={{ start: picked, end: null }} onPick={setPicked} marks={marks} />
        </BottomSheet>
      )}
    </>
  );
}

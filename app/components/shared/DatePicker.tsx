"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import BottomSheet from "@/app/components/shared/BottomSheet";
import { addMonths, monthGrid, sameMonth } from "@/lib/time/calendar";
import { formatDay } from "@/lib/time/format";
import { addDays, deviceTimeZone, localDay, type LocalDay } from "@/lib/time/zone";

// The date picker (studygroup-spec C4, sheet 8.1–8.2): one month at a time,
// Monday first. Today has a ring, the chosen day is filled, past days are
// muted, for a range the days between are tinted, and session days carry a
// dot. Used for book dates (M9) and session days (M8).

export type DayRange = { start: LocalDay | null; end: LocalDay | null };

const today = () => localDay(Date.now(), deviceTimeZone());

// The weekday header, from a known Monday (5 Oct 2026) in the viewer's locale.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => addDays("2026-10-05", i));

/** `marks`: days with a dot under them (the group's session days); days
 * before `min` can't be picked; it opens on `focus`'s month. */
function MonthPicker({
  range,
  onPick,
  marks,
  min,
  focus,
}: {
  range: DayRange;
  onPick: (day: LocalDay) => void;
  marks?: LocalDay[];
  min?: LocalDay | null;
  focus?: LocalDay | null;
}) {
  const now = today();
  const [month, setMonth] = useState(() => addMonths(focus ?? range.start ?? now, 0));
  const { start, end } = range;

  const navButton =
    "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--reader-border)] bg-transparent text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))} className={navButton}>
          <ChevronLeft size={16} />
        </button>
        <span className="font-serif text-base font-semibold text-[var(--reader-text)]" aria-live="polite">
          {formatDay(month, "month")}
        </span>
        <button type="button" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))} className={navButton}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div role="grid" className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-1 text-[10px] font-semibold text-[var(--reader-text-muted)]">
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
                disabled={!!min && day < min}
                onClick={() => onPick(day)}
                className={`relative box-border h-9 w-9 cursor-pointer rounded-full border-0 text-[13px] disabled:cursor-not-allowed disabled:opacity-30 ${tone}`}
              >
                {+day.slice(8)}
                {marks?.includes(day) && (
                  <span
                    aria-hidden
                    className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${chosen ? "bg-white" : "bg-brand-500"}`}
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

const doneButton =
  "h-9 cursor-pointer rounded-sm border-none bg-brand-500 px-4 text-[13px] font-bold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60";
const clearButton =
  "h-9 cursor-pointer rounded-sm border border-[var(--reader-border)] bg-transparent px-4 text-[13px] font-bold text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]";

const backButton =
  "flex h-9 cursor-pointer items-center gap-1 rounded-sm border-none bg-transparent px-2 text-[13px] font-bold text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]";

/** A From or To field: its label over the day, or "Pick a day". */
function EndField({ label, day, onClick }: { label: string; day: LocalDay | null; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full cursor-pointer flex-col gap-1.5 border-none bg-transparent p-0 text-left text-xs font-semibold text-[var(--reader-text-muted)]">
      {label}
      <span className="box-border flex w-full items-center gap-2 rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)] px-3 py-2.5 text-[13px] font-medium text-[var(--reader-text)]">
        <CalendarDays size={16} className="text-[var(--reader-text-muted)]" />
        {day ? formatDay(day, "day") : <span className="text-[var(--reader-text-subtle)]">Pick a day</span>}
      </span>
    </button>
  );
}

/** Pick a range: the sheet opens on two fields, From and To. Either opens
 * the month for that end, with Back and Select; To can't fall before From
 * (the same day makes it a single day), and a From past the To clears it.
 * Clear sets no dates. */
export function DateRangeSheet({
  initial,
  marks,
  onDone,
  onClose,
}: {
  initial: DayRange;
  marks?: LocalDay[];
  onDone: (range: DayRange) => void;
  onClose: () => void;
}) {
  const [range, setRange] = useState(initial);
  // Which end the month is open for, and the day picked there so far.
  const [editing, setEditing] = useState<{ end: "start" | "end"; day: LocalDay | null } | null>(null);
  const { start, end } = range;

  const select = () => {
    if (!editing?.day) return;
    const day = editing.day;
    setRange(editing.end === "start" ? { start: day, end: end && end >= day ? end : null } : { start, end: day });
    setEditing(null);
  };

  if (editing) {
    const picking = editing.end === "start";
    return (
      <BottomSheet
        title={picking ? "From" : "To"}
        onClose={onClose}
        footer={
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setEditing(null)} className={backButton}>
              <ChevronLeft size={16} />
              Back
            </button>
            <button type="button" disabled={!editing.day} onClick={select} className={doneButton}>
              Select
            </button>
          </div>
        }
      >
        <MonthPicker
          range={picking ? { start: editing.day, end: null } : { start, end: editing.day }}
          onPick={(day) => setEditing({ ...editing, day })}
          marks={marks}
          min={picking ? null : start}
          focus={editing.day ?? start}
        />
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          {(start || end) && (
            <button type="button" onClick={() => setRange({ start: null, end: null })} className={`${clearButton} mr-auto`}>
              Clear
            </button>
          )}
          <button type="button" onClick={() => onDone(range)} className={doneButton}>
            Done
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <EndField label="From" day={start} onClick={() => setEditing({ end: "start", day: start })} />
        <EndField label="To" day={end} onClick={() => setEditing({ end: "end", day: end })} />
      </div>
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
                <span className="text-[10px] text-[var(--reader-text-muted)]">Selected</span>
                <span className="truncate text-[13px] font-semibold text-[var(--reader-text)]">
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

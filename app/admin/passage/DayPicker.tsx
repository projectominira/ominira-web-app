"use client";

import { X } from "lucide-react";
import type { CalendarView, PassageKind, QuoteView } from "@/lib/passage/types";

// Shared by the calendar and the quote card (passage-spec §8.4).

export const KIND_LABEL: Record<PassageKind, string> = { anniversary: "Anniversary", topical: "Topical", evergreen: "Evergreen" };

/** "2026-11-12" → "Thu 12 Nov". */
export const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** The day Approve would give a quote (§8.3), as the server works it out:
 * an anniversary's own date, else the first open day from tomorrow. Null
 * when an anniversary's date has gone, so a day must be picked. */
export function approveDay(quote: QuoteView, calendar: CalendarView): string | null {
  if (quote.kind === "anniversary" && quote.wantedDay) {
    const open = calendar.days[0].posted ? calendar.days[1].day : calendar.today;
    return quote.wantedDay >= open ? quote.wantedDay : null;
  }
  return calendar.days.slice(1).find((d) => !d.quote)?.day ?? null;
}

/**
 * The next 30 days to pick one from: Move (a held day swaps) or Approve for
 * another day (open days only). Today's posted passage can't be picked.
 */
export default function DayPicker({
  calendar,
  current,
  openOnly = false,
  title,
  onPick,
  onClose,
}: {
  calendar: CalendarView;
  /** The quote's own day, marked and not pickable. */
  current?: string | null;
  openOnly?: boolean;
  title: string;
  onPick: (day: string) => void;
  onClose: () => void;
}) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-[420px] flex-col overflow-hidden rounded-sm bg-[var(--reader-surface)] shadow-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--reader-border)] px-4 py-3">
          <h2 className="m-0 font-serif text-[16px] font-semibold text-[var(--reader-text)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-[var(--reader-text-muted)] hover:bg-[var(--reader-surface-hover)]"
          >
            <X size={16} />
          </button>
        </div>
        <ul className="m-0 list-none overflow-y-auto p-1">
          {calendar.days.map((d) => {
            const mine = d.day === current;
            const disabled = mine || !!d.posted || (openOnly && !!d.quote);
            return (
              <li key={d.day}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(d.day)}
                  className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-sm border-none bg-transparent px-3 text-left text-[13px] enabled:hover:bg-[var(--reader-surface-hover)] disabled:cursor-default disabled:opacity-45"
                >
                  <span className="w-24 flex-none font-semibold text-[var(--reader-text)] tabular-nums">
                    {d.day === calendar.today ? "Today" : dayLabel(d.day)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[var(--reader-text-muted)]">
                    {mine ? "This passage" : d.posted ? `Posted · ${d.posted.book ?? ""}` : d.quote ? d.quote.book.title : "Open"}
                  </span>
                  {!disabled && d.quote && <span className="flex-none text-ui-xs text-[var(--reader-text-subtle)]">Swap</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

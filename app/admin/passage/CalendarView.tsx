"use client";

import { useState } from "react";
import { ArrowUpRight, CalendarDays, CalendarX, Plus } from "lucide-react";
import RowMenu from "@/app/components/groups/RowMenu";
import { addDays, weekdayOf } from "@/lib/time/zone";
import { quoteText, type CalendarDay, type CalendarView as Calendar, type QuoteView } from "@/lib/passage/types";
import { showToast } from "@/stores/toast-store";
import DayPicker, { dayLabel, KIND_LABEL } from "./DayPicker";
import { stripMarkers } from "./QuoteCard";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const FILL = "inline-flex h-8 cursor-pointer items-center gap-1 rounded-sm border border-dashed border-sand-300 bg-transparent px-2.5 text-[13px] font-semibold text-[var(--reader-text-muted)] transition-colors hover:border-brand-400 hover:text-brand-600";

async function patch(url: string, body: unknown, method = "PATCH") {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Please try again.");
  return data;
}

/** "This week", "Next week", then "Week of 23 Nov", by Monday. */
function weekTitle(day: string, today: string) {
  const monday = (d: string) => addDays(d, -weekdayOf(d));
  const weeks = Math.round((Date.parse(monday(day)) - Date.parse(monday(today))) / (7 * 86_400_000));
  if (weeks === 0) return "This week";
  if (weeks === 1) return "Next week";
  return `Week of ${new Date(`${monday(day)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;
}

/**
 * The next 30 days (passage-spec §8.4): a strip showing which days are
 * planned, then a row per day, today first and highlighted, grouped by
 * week. Planned rows drag onto another day (a held day swaps) or move from
 * ⋯; an open day's Fill approves a quote waiting for review.
 */
export default function CalendarView({
  calendar,
  onOpenQuote,
  onOpenPosted,
  onFill,
  onChanged,
}: {
  calendar: Calendar;
  onOpenQuote: (quote: QuoteView) => void;
  onOpenPosted: () => void;
  onFill: (day: string) => void;
  /** Something moved: reload the calendar. */
  onChanged: () => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [moving, setMoving] = useState<QuoteView | null>(null);
  const { today, days } = calendar;

  const move = async (quote: QuoteView, day: string) => {
    setMoving(null);
    if (quote.day === day) return;
    try {
      const data = await patch(`/api/admin/passage/quotes/${quote.id}`, { day });
      showToast(`Moved to ${dayLabel(data.day)}${data.swapped ? ", swapping the two" : ""}.`);
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Please try again.");
    }
  };

  const unschedule = async (quote: QuoteView) => {
    try {
      await patch(`/api/admin/passage/quotes/${quote.id}`, { status: "new" });
      showToast("Back in To review.");
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Please try again.");
    }
  };

  const dragged = dragging ? days.find((d) => d.quote?.id === dragging)?.quote : undefined;
  const canDrop = (d: CalendarDay) => !!dragged && !d.posted && d.day !== dragged.day;

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Days planned" className="flex gap-[3px]">
        {days.map((d) => {
          const filled = !!d.posted || !!d.quote;
          return (
            <a
              key={d.day}
              href={`#day-${d.day}`}
              title={`${d.day === today ? "Today" : dayLabel(d.day)}: ${filled ? (d.posted ? "posted" : "planned") : "open"}`}
              className={`h-6 min-w-0 flex-1 rounded-[2px] transition-opacity hover:opacity-75 ${filled ? "bg-brand-500" : "bg-[var(--reader-surface-hover)]"} ${
                d.day === today ? "ring-2 ring-[var(--reader-text)] ring-offset-1 ring-offset-[var(--reader-bg)]" : ""
              }`}
            />
          );
        })}
      </nav>

      <div className="overflow-hidden rounded-sm border border-[var(--reader-border)]">
        {days.map((d, i) => {
          const title = weekTitle(d.day, today);
          const isToday = d.day === today;
          const q = d.quote;
          return (
            <div key={d.day}>
              {(i === 0 || weekTitle(days[i - 1].day, today) !== title) && (
                <div
                  className={`bg-[var(--reader-bg)] px-4 py-2 text-ui-xs tracking-eyebrow uppercase text-[var(--reader-text-subtle)] ${i > 0 ? "border-t border-[var(--reader-border)]" : ""}`}
                >
                  {title}
                </div>
              )}
              <div
                id={`day-${d.day}`}
                draggable={!!q && !d.posted}
                onDragStart={(e) => {
                  if (!q) return;
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", q.id);
                  setDragging(q.id);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
                onDragOver={(e) => {
                  if (!canDrop(d)) return;
                  e.preventDefault();
                  setOver(d.day);
                }}
                onDragLeave={() => setOver((o) => (o === d.day ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragged && canDrop(d)) void move(dragged, d.day);
                  setDragging(null);
                  setOver(null);
                }}
                onClick={() => (d.posted ? onOpenPosted() : q ? onOpenQuote(q) : undefined)}
                className={`flex scroll-mt-24 items-start gap-3 border-t border-[var(--reader-border)] px-4 py-3 transition-colors ${
                  d.posted || q ? "cursor-pointer hover:bg-[var(--reader-surface-hover)]" : ""
                } ${isToday ? "bg-[var(--reader-surface)] shadow-[inset_3px_0_0_var(--color-brand-500)]" : ""} ${
                  over === d.day ? "bg-brand-50 outline-2 -outline-offset-2 outline-dashed outline-brand-400" : ""
                } ${dragging === q?.id && q ? "opacity-50" : ""} ${q && !d.posted ? "sm:cursor-grab" : ""}`}
              >
                <div className="w-[68px] flex-none pt-0.5 sm:w-[84px]">
                  <div className={`text-[13px] font-semibold tabular-nums ${isToday ? "text-brand-600" : "text-[var(--reader-text)]"}`}>
                    {isToday ? "Today" : dayLabel(d.day).split(" ")[0]}
                  </div>
                  <div className="text-ui-caption text-[var(--reader-text-muted)] tabular-nums">{dayLabel(d.day).split(" ").slice(1).join(" ")}</div>
                </div>

                {d.posted ? (
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="m-0 text-[13px]/[1.4] font-semibold text-[var(--reader-text)]">{d.posted.question}</p>
                    <p className="m-0 line-clamp-1 font-serif text-[15px]/[1.5] text-[var(--reader-text-muted)]">&ldquo;{d.posted.quote}&rdquo;</p>
                    <p className="m-0 text-ui-caption text-[var(--reader-text-muted)]">
                      Posted · {[d.posted.book, plural(d.posted.answers, "answer")].filter(Boolean).join(" · ")} ·{" "}
                      <a
                        href={`/note/${d.posted.postId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-[var(--reader-text)] hover:underline"
                      >
                        Open thread
                      </a>
                    </p>
                  </div>
                ) : q ? (
                  <>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="m-0 truncate text-ui-caption text-[var(--reader-text-muted)]">
                        <span className="font-semibold text-[var(--reader-text)]">{KIND_LABEL[q.kind]}</span>
                        {q.occasion && <> · {q.occasion}</>}
                        {isToday && <> · goes out at 07:00</>}
                      </p>
                      <p className="m-0 line-clamp-2 font-serif text-[15px]/[1.5] text-[var(--reader-text)]">&ldquo;{stripMarkers(quoteText(q.ranges))}&rdquo;</p>
                      <p className="m-0 truncate text-ui-caption text-[var(--reader-text-muted)]">
                        {q.book.title}
                        {q.book.author && <> · {q.book.author}</>}
                      </p>
                    </div>
                    <div onClick={(e) => e.stopPropagation()} className="flex-none">
                      <RowMenu
                        label="More"
                        items={[
                          { label: "Move…", icon: <CalendarDays size={14} />, onClick: () => setMoving(q) },
                          { label: "Unschedule", icon: <CalendarX size={14} />, onClick: () => unschedule(q) },
                          { label: "Open", icon: <ArrowUpRight size={14} />, onClick: () => onOpenQuote(q) },
                        ]}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3 self-center">
                    <span className="text-ui-sm text-[var(--reader-text-subtle)]">Open</span>
                    <button type="button" onClick={() => onFill(d.day)} className={FILL}>
                      <Plus size={13} /> Fill
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {moving && (
        <DayPicker calendar={calendar} current={moving.day} title="Move to" onPick={(day) => move(moving, day)} onClose={() => setMoving(null)} />
      )}
    </div>
  );
}

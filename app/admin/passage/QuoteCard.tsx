"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, CalendarDays, CalendarX, Check, RotateCcw, Sun, Undo2, X } from "lucide-react";
import RowMenu from "@/app/components/groups/RowMenu";
import PassageCard from "@/app/components/home/PassageCard";
import { useShareQuote } from "@/app/components/reader/ShareQuoteModal";
import type { AnnotationRange } from "@/lib/api/types";
import { ensureFreshSession } from "@/lib/api/client";
import { communityFeedItemHref } from "@/lib/community/useCommunityFeed";
import { passageContext, quoteText, type CalendarView, type ContextBlock, type QuoteView } from "@/lib/passage/types";
import DayPicker, { approveDay, dayLabel, KIND_LABEL } from "./DayPicker";
import { sameRanges } from "@/stores/library-store";
import { showToast } from "@/stores/toast-store";

export const BUTTON =
  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-sm border border-sand-300 bg-transparent px-3 text-[13px] font-semibold text-[var(--reader-text)] no-underline transition-colors hover:bg-[var(--reader-surface-hover)] disabled:cursor-default disabled:opacity-50";
export const PRIMARY =
  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-sm border-none bg-brand-500 px-3 text-[13px] font-bold text-white transition-colors hover:bg-brand-600 disabled:cursor-default disabled:opacity-50";
/** A plain text action: the panel's row of links. */
const LINK =
  "inline-flex h-8 cursor-pointer items-center rounded-sm border-none bg-transparent px-2 text-[13px] font-semibold text-[var(--reader-text-muted)] transition-colors hover:text-[var(--reader-text)] disabled:cursor-default disabled:opacity-50";
/** A quiet text action: icon and label, no border. */
const GHOST =
  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border-none bg-transparent px-2 text-[13px] font-semibold text-[var(--reader-text-muted)] no-underline transition-colors hover:bg-[var(--reader-surface-hover)] hover:text-[var(--reader-text)] disabled:cursor-default disabled:opacity-50";

const MAX_BLOCKS = 5;

/** "2026-10-24" → "Oct 24". */
export const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });

/** PDFium's invisible markers (a line-break hyphen is U+FFFE): kept in the
 * text so offsets match, never shown. */
const MARKERS = /([­​⁠﻿￾￿])/;
export const stripMarkers = (text: string) => text.replace(new RegExp(MARKERS.source, "g"), "");

function Plain({ text }: { text: string }) {
  const parts = text.split(MARKERS);
  return parts.map((part, i) => (i % 2 ? <span key={i} hidden>{part}</span> : part));
}

/** Where a selection end sits: its block and the offset in that block's
 * text. Range#toString counts every text node, hidden ones included. */
function pointIn(root: HTMLElement, node: Node, offset: number) {
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const block = el?.closest<HTMLElement>("[data-block]");
  if (!block || !root.contains(block)) return null;
  const range = document.createRange();
  range.setStart(block, 0);
  range.setEnd(node, offset);
  return { block: block.dataset.block!, offset: range.toString().length };
}

/** The current selection inside `root` as ranges over `context`, or null. */
function selectionRanges(root: HTMLElement, context: ContextBlock[]): AnnotationRange[] | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  const a = pointIn(root, r.startContainer, r.startOffset);
  const b = pointIn(root, r.endContainer, r.endOffset);
  if (!a || !b) return null;
  const from = context.findIndex((c) => c.passageId === a.block);
  const to = context.findIndex((c) => c.passageId === b.block);
  const ranges: AnnotationRange[] = [];
  for (let i = from; i <= to && i >= 0; i++) {
    const { passageId, text } = context[i];
    const start = i === from ? a.offset : 0;
    const end = i === to ? b.offset : text.length;
    if (end > start && text.slice(start, end).trim()) ranges.push({ passageId, start, end });
  }
  return ranges.length > 0 && ranges.length <= MAX_BLOCKS ? ranges : null;
}

/**
 * The quote's context as plain serif text with the current words
 * highlighted, opened by "Edit words". Selecting text (dragging, or
 * press-and-drag the handles on a phone) shows "Use selection", which saves
 * it as the quote's new words.
 */
function ContextText({ context, ranges, onUse }: { context: ContextBlock[]; ranges: AnnotationRange[]; onUse: (ranges: AnnotationRange[]) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLElement>(null);
  const [pending, setPending] = useState<AnnotationRange[] | null>(null);

  // Open with the quote a third of the way down, so the words before it show.
  useEffect(() => {
    const root = rootRef.current;
    const mark = markRef.current;
    if (root && mark) root.scrollTop = Math.max(0, mark.offsetTop - root.clientHeight / 3);
  }, []);

  useEffect(() => {
    let clear: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      const next = rootRef.current && selectionRanges(rootRef.current, context);
      clearTimeout(clear);
      // A tap on the button can clear the selection before its click lands.
      if (next) setPending(next);
      else clear = setTimeout(() => setPending(null), 300);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      document.removeEventListener("selectionchange", onChange);
      clearTimeout(clear);
    };
  }, [context]);

  const firstMarked = context.findIndex((b) => ranges.some((r) => r.passageId === b.passageId));
  return (
    <div className="relative">
      <div
        ref={rootRef}
        className="relative max-h-[300px] overflow-y-auto px-4 py-3 font-serif text-[14px]/[1.65] text-[var(--reader-text-muted)] sm:text-[15px]/[1.7] selection:bg-brand-300/50"
      >
        {context.map((block, i) => {
          const r = ranges.find((x) => x.passageId === block.passageId);
          return (
            <p key={block.passageId} data-block={block.passageId} className="m-0 mb-3 last:mb-0">
              {r ? (
                <>
                  <Plain text={block.text.slice(0, r.start)} />
                  <mark ref={i === firstMarked ? markRef : undefined} className="rounded-[2px] bg-brand-200/60 text-[var(--reader-text)]">
                    <Plain text={block.text.slice(r.start, r.end)} />
                  </mark>
                  <Plain text={block.text.slice(r.end)} />
                </>
              ) : (
                <Plain text={block.text} />
              )}
            </p>
          );
        })}
      </div>
      {pending && (
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            onUse(pending);
            setPending(null);
            window.getSelection()?.removeAllRanges();
          }}
          className={`${PRIMARY} absolute right-3 bottom-3 shadow-md`}
        >
          Use selection
        </button>
      )}
    </div>
  );
}

async function send(url: string, body: unknown, method = "PATCH", headers: Record<string, string> = {}) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Please try again.");
  return data;
}

/**
 * One quote (passage-spec §3, §8.4): why this day, the words, where they're
 * from and why. Its main action approves
 * it for a day ("Approve for Thu 12 Nov"); once approved it can move or be
 * unscheduled. "Edit words" opens the context to reselect; the rest is in ⋯.
 */
export default function QuoteCard({
  quote,
  onChange: setQuote,
  members,
  calendar,
  onUsed,
  onScheduled,
  onApproved,
}: {
  quote: QuoteView;
  /** Updates the quote where it's listed. */
  onChange: (update: (q: QuoteView) => QuoteView) => void;
  members: number;
  calendar: CalendarView;
  onUsed: () => void;
  /** A day was given, changed or taken away: the calendar reloads. */
  onScheduled: () => void;
  /** Approved: To review moves on to the next quote. */
  onApproved?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [picking, setPicking] = useState<"approve" | "move" | null>(null);
  const hasToday = !!calendar.days[0].posted;
  const nextDay = approveDay(quote, calendar);
  const [busy, setBusy] = useState(false);
  const { book } = quote;
  const shareQuote = useShareQuote(book.title, book.author);
  const words = stripMarkers(quoteText(quote.ranges));
  const sectionId = quote.ranges[0]?.passageId.match(/^(.+)-p\d+$/)?.[1] ?? null;
  const href = communityFeedItemHref({ material: book, sectionId, note: { ranges: quote.ranges } });
  const where = quote.chapter ?? (quote.page ? `p. ${quote.page}` : null);
  const trimmed = !sameRanges(quote.ranges, quote.picked);

  const fail = (err: unknown) => showToast(err instanceof Error ? err.message : "Please try again.");

  const trim = async (ranges: AnnotationRange[]) => {
    const before = quote.ranges;
    try {
      const data = await send(`/api/admin/passage/quotes/${quote.id}`, { ranges });
      setQuote((q) => ({ ...q, ranges: data.ranges }));
    } catch (err) {
      setQuote((q) => ({ ...q, ranges: before }));
      fail(err);
    }
  };

  const setStatus = async (status: "new" | "dismissed") => {
    const wasApproved = quote.status === "approved";
    try {
      await send(`/api/admin/passage/quotes/${quote.id}`, { status });
      setQuote((q) => ({ ...q, status, day: null }));
      if (status === "dismissed") setEditing(false);
      if (wasApproved) onScheduled();
    } catch (err) {
      fail(err);
    }
  };

  const approve = async (day?: string) => {
    setPicking(null);
    setBusy(true);
    try {
      const data = await send(`/api/admin/passage/quotes/${quote.id}/schedule`, day ? { day } : {}, "POST");
      setQuote((x) => ({ ...x, status: "approved", day: data.day }));
      showToast(`Approved for ${dayLabel(data.day)}${data.bumped ? `. The evergreen passage moved to ${dayLabel(data.bumped.day)}` : ""}.`);
      onScheduled();
      onApproved?.();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const move = async (day: string) => {
    setPicking(null);
    try {
      const data = await send(`/api/admin/passage/quotes/${quote.id}`, { day });
      setQuote((x) => ({ ...x, day: data.day }));
      showToast(`Moved to ${dayLabel(data.day)}${data.swapped ? ", swapping the two" : ""}.`);
      onScheduled();
    } catch (err) {
      fail(err);
    }
  };

  const use = async () => {
    setBusy(true);
    try {
      const token = await ensureFreshSession();
      await send(`/api/admin/passage/quotes/${quote.id}/use`, {}, "POST", token ? { Authorization: `Bearer ${token}` } : {});
      setQuote((q) => ({ ...q, status: "used", usedOn: new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }) }));
      setConfirming(false);
      showToast("Today's passage is set.");
      onUsed();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  if (quote.status === "dismissed") {
    return (
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 font-serif text-[15px] text-[var(--reader-text-subtle)] line-through decoration-[var(--reader-border)]">
          {words}
        </span>
        <button type="button" onClick={() => setStatus("new")} className={GHOST}>
          <Undo2 size={14} /> Restore
        </button>
      </div>
    );
  }

  const approved = quote.status === "approved";
  return (
    <article className="flex flex-col gap-3">
      {(approved || quote.occasion || quote.kind !== "evergreen") && (
        <div className="flex flex-col gap-0.5">
          {approved && quote.day && (
            <span className="text-ui-xs font-semibold tracking-eyebrow uppercase text-brand-600">
              Scheduled · {quote.day === calendar.today ? "today" : dayLabel(quote.day)}
            </span>
          )}
          <span className="text-ui-sm text-[var(--reader-text-muted)]">
            <span className="font-semibold text-[var(--reader-text)]">{KIND_LABEL[quote.kind]}</span>
            {quote.kind === "anniversary" && quote.wantedDay && <> · {dayLabel(quote.wantedDay)}</>}
            {quote.occasion && <> · {quote.occasion}</>}
          </span>
        </div>
      )}

      <blockquote className="m-0 border-l-2 border-brand-400 pl-3 font-serif text-[15px]/[1.6] text-pretty sm:text-[16px]/[1.65] sm:pl-4 text-[var(--reader-text)]">
        &ldquo;{words}&rdquo;
      </blockquote>

      <p className="m-0 text-ui-caption text-[var(--reader-text-muted)]">
        <span className="font-semibold text-[var(--reader-text)]">{book.title}</span>
        {book.author && <> · {book.author}</>}
        {where && <> · {where}</>}
      </p>

      {quote.why && <p className="m-0 text-ui-sm text-[var(--reader-text-muted)]">{quote.why}</p>}

      {editing && (
        <div className="overflow-hidden rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)]">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--reader-border)] px-4 py-2">
            <span className="text-ui-caption text-[var(--reader-text-muted)]">Select the words to quote</span>
            <div className="flex items-center gap-1">
              {trimmed && (
                <button type="button" onClick={() => trim(quote.picked)} className={GHOST}>
                  <RotateCcw size={13} /> Reset
                </button>
              )}
              <button type="button" onClick={() => setEditing(false)} className={GHOST}>
                <Check size={14} /> Done
              </button>
            </div>
          </div>
          <ContextText key={JSON.stringify(quote.ranges)} context={quote.context} ranges={quote.ranges} onUse={trim} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 pt-1">
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className={LINK}>
            Edit words
          </button>
        )}
        <button type="button" onClick={() => shareQuote.share(words)} className={LINK}>
          Export
        </button>
        {quote.status === "new" && (
          <button type="button" disabled={busy} onClick={() => (nextDay ? approve() : setPicking("approve"))} className={`${LINK} text-brand-600 hover:text-brand-700`}>
            {nextDay ? `Approve for ${nextDay === calendar.today ? "today" : dayLabel(nextDay)}` : "Approve for…"}
          </button>
        )}
        <RowMenu
          label="More"
          items={[
            ...(approved
              ? [
                  { label: "Move…", icon: <CalendarDays size={14} />, onClick: () => setPicking("move") },
                  { label: "Unschedule", icon: <CalendarX size={14} />, onClick: () => setStatus("new") },
                ]
              : quote.status === "new" && nextDay
                ? [{ label: "Approve for another day…", icon: <CalendarDays size={14} />, onClick: () => setPicking("approve") }]
                : []),
            { label: "Set for today", icon: <Sun size={14} />, onClick: () => setConfirming(true) },
            ...(href ? [{ label: "Open in reader", icon: <ArrowUpRight size={14} />, onClick: () => window.open(href, "_blank", "noopener") }] : []),
            ...(quote.status === "new" ? [{ label: "Dismiss", icon: <X size={14} />, onClick: () => setStatus("dismissed") }] : []),
          ]}
        />
      </div>
      {shareQuote.modal}
      {picking && (
        <DayPicker
          calendar={calendar}
          current={picking === "move" ? quote.day : null}
          openOnly={picking === "approve"}
          title={picking === "move" ? "Move to" : "Approve for"}
          onPick={(day) => (picking === "move" ? move(day) : approve(day))}
          onClose={() => setPicking(null)}
        />
      )}

      {confirming && (
        <div onClick={() => !busy && setConfirming(false)} className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`use-${quote.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-[460px] flex-col gap-4 overflow-y-auto rounded-sm bg-[var(--reader-surface)] p-5 shadow-lg"
          >
            <h2 id={`use-${quote.id}`} className="m-0 font-serif text-[16px] font-semibold text-[var(--reader-text)]">
              Set as today&rsquo;s passage
            </h2>
            <div className="pointer-events-none">
              <PassageCard
                passage={{
                  excerpt: words,
                  day: dayLabel(calendar.today),
                  context: passageContext(quote.kind, quote.occasion),
                  href: href ?? "",
                  book: { title: book.title, author: book.author, cover: null, materialType: book.materialType },
                  where: quote.chapter ?? (quote.page ? `Page ${quote.page}` : null),
                }}
              />
            </div>
            <p className="m-0 text-ui-sm text-[var(--reader-text-muted)]">
              {hasToday
                ? "Replaces today’s passage. Members already notified today aren’t notified again."
                : `Notifies ${members.toLocaleString("en")} members.`}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={BUTTON}>
                Cancel
              </button>
              <button type="button" disabled={busy} onClick={use} className={PRIMARY}>
                {busy ? "Setting…" : hasToday ? "Replace today’s passage" : "Set and notify"}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

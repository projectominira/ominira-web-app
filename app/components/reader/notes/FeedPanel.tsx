"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import NoResults from "@/app/components/shared/NoResults";
import BookCover from "@/app/components/shared/BookCover";
import ReaderAvatar from "@/app/components/shared/ReaderAvatar";
import { useReaderRoomHead } from "@/lib/rooms/hooks";
import { comradeName } from "@/lib/reader/authorDisplay";
import type { FeedEntry, FeedLocator } from "@/lib/reader/annotationFeed";
import type { FeedItem, FeedTab } from "@/lib/reader/useFeed";
import type { AnnotationRange, Note } from "@/lib/api/types";
import PanelShell from "./PanelShell";
import FeedHighlightThread from "./FeedHighlightThread";
import GeneralNoteThread from "./GeneralNoteThread";
import BookRoomPane from "./BookRoomPane";
import { notesLabel } from "../ReaderPresence";

/** A stable DOM id per item — looked up via `document.getElementById` in an
 * effect to position the panel on open, same reasoning as the note panel's
 * own composer-focus effects: this project's stricter ref-access lint rule
 * rejects a ref callback produced inside a `.map()`, unlike a single
 * non-looped element. */
function feedItemElementId(item: FeedItem): string {
  return item.kind === "highlight" ? `feed-item-${item.entry.annotation.id}` : `feed-item-${item.note.id}`;
}

type FeedItemRun = { key: string; label: string; items: FeedItem[] };

/** Which category an item belongs to — "general" for every General
 * discussion note (they're all one category together), a highlight's own
 * `sectionId` otherwise. */
function feedItemCategoryKey(item: FeedItem): string {
  return item.kind === "general" ? "general" : item.entry.sectionId;
}

function feedItemCategoryLabel(item: FeedItem): string {
  return item.kind === "general" ? "General discussion" : item.entry.label;
}

/** Buckets a flat, already-grouped `items` list (General discussion first,
 * then every highlight in spine order — chapters are necessarily
 * contiguous runs there) into consecutive same-category runs — one pass,
 * no re-sorting. Each run renders under a single FeedItemLabel (with its
 * own count) instead of the label repeating above every item. */
function groupFeedItemsByCategory(items: FeedItem[]): FeedItemRun[] {
  const runs: FeedItemRun[] = [];
  for (const item of items) {
    const key = feedItemCategoryKey(item);
    const last = runs[runs.length - 1];
    if (last && last.key === key) last.items.push(item);
    else runs.push({ key, label: feedItemCategoryLabel(item), items: [item] });
  }
  return runs;
}

/** One category's own context label — which chapter a run of highlights'
 * passages live in, or "General discussion" for a run of book-level
 * notes — plus that run's own count, same "N topics"/"N highlights"
 * convention this feed's per-section headers used before it flattened
 * into one continuous list. A page-level section header in spirit, just
 * without the sticky per-section grouping the feed used to have:
 * everything still scrolls as one continuous, single-screen feed
 * (expand/collapse a thread in place, same as the standalone note panel),
 * this only stops the label itself from repeating above every single
 * item. Full-bleed (-mx-5/px-5 cancels the body's own side padding) — a
 * thin bar spanning the panel's full width, not padded/inset to match the
 * note card sitting under it, so it reads as this run's own running head
 * rather than another line inside the first card. No icon — the text
 * alone (General discussion vs. an actual chapter title) already tells
 * the two kinds apart, so one wasn't earning its keep. Plain text over a
 * border-bottom for now, same treatment this feed already used before a
 * background tint was tried here — a background sized to just the text
 * (not the full-bleed bar) is worth another pass later, but isn't this
 * one. */
function FeedItemLabel({ run, filter }: { run: FeedItemRun; filter: FeedTab }) {
  const count = run.items.length;
  const noun = filter === "notes" ? (count === 1 ? "note" : "notes") : count === 1 ? "highlight" : "highlights";
  return (
    <div className="-mx-5 mb-2 flex items-center justify-between gap-3 border-b border-[var(--reader-border)] px-5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--reader-text-subtle)]">
      <span className="min-w-0 flex-1 truncate">{run.label}</span>
      <span className="flex-none normal-case tracking-normal text-[var(--reader-text-subtle)]">
        {count} {noun}
      </span>
    </div>
  );
}

/** The book's feed panel: the book room (its notes), and the book-wide
 * annotation feed — every mark of any kind, grouped under a
 * context label per run (which chapter, or General discussion — see
 * FeedItemLabel), each item's own full, real interactive thread (see
 * FeedHighlightThread) sitting under it — a bare
 * highlight renders as just the quote and a collapsed "add a note"
 * composer, same component either way. One continuous, single-screen feed:
 * a thread expands/collapses in place (its own ReplyButton toggle), it
 * never drills into a separate view — same "the discourse happens right
 * here" shape as the standalone note panel. Always in `items`' own default
 * order (General discussion first, then every highlight in spine order) —
 * no sort control here; the Top/Recent toggle this briefly had kept
 * fighting with UnderlineTabs' own alignment, so it's shelved for now (see
 * useFeed, which still computes the "book" order this
 * defaults to — a real sort control can come back once it has a spot that
 * doesn't fight the tabs). Opening the panel scrolls once to wherever the
 * reader currently is in the book; browsing the feed itself never
 * re-scrolls on its own. */
export default function FeedPanel({
  materialId,
  items,
  notes,
  filter,
  activeSectionId,
  onJump,
  onPassage,
  getPassageText,
  locate,
  panelType,
  onClose,
  targetNoteId,
  targetThreadId,
  focusedAuthor,
  onClearAuthor,
}: {
  materialId: string;
  items: FeedItem[];
  /** The material's whole flat note list — GeneralNoteThread's own source
   * for each general note's replies (see its doc comment); nothing else
   * here needs it. */
  notes: Note[];
  filter: FeedTab;
  onFilterChange: (filter: FeedTab) => void;
  /** The run the reader is in now — the panel opens scrolled to it. */
  activeSectionId?: string;
  onJump: (entry: FeedEntry) => void;
  /** A quote in the room opened: the reader scrolls to its passage. */
  onPassage?: (sectionId: string, ranges: AnnotationRange[], mine: boolean) => void;
  getPassageText: (passageId: string) => string;
  /** Where a passage sits — places your just-made highlights in the room. */
  locate: FeedLocator;
  panelType?: "side" | "sheet";
  onClose: () => void;
  /** Deep-link from push notification for a general note — scrolls to and
   * flashes that note instead of the default active-section positioning. */
  targetNoteId?: string;
  /** Specific thread (root note id) whose replies should be fully shown
   * when deep-linked from a notification. Duplicates targetNoteId for
   * general notes, separate for anchored highlights. */
  targetThreadId?: string;
  /** The comrade the feed is narrowed to, opened from their face. */
  focusedAuthor: { author: Note["author"]; count: number } | null;
  onClearAuthor: () => void;
}) {
  const onNotes = filter === "notes";
  const router = useRouter();
  const { book } = useReaderRoomHead(materialId);
  // One comrade's notes say so under the title, with All notes to undo it.
  const narrowed = onNotes && focusedAuthor;
  const runs = useMemo(() => groupFeedItemsByCategory(items), [items]);
  // Positioning: fires once per "panel just opened" but also waits for items
  // to arrive when deep-linking to a specific general note. The panel mounts
  // synchronously with `noteFeed.open=true`, but `items` may still be
  // fetching from useAnnotations — so we retry until the target is found or
  // we fall back to the default active-section scroll.
  const hasPositionedRef = useRef(false);
  useEffect(() => {
    if (hasPositionedRef.current) return;
    // One comrade's notes read top to bottom — no mid-feed positioning.
    if (focusedAuthor) {
      hasPositionedRef.current = true;
      return;
    }
    // Deep-link to a specific note takes precedence over position-based scroll.
    if (targetNoteId) {
      const target = items.find((item) => feedItemElementId(item) === `feed-item-${targetNoteId}`);
      if (target) {
        hasPositionedRef.current = true;
        requestAnimationFrame(() => {
          const el = document.getElementById(feedItemElementId(target));
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          if (el) {
            el.classList.add("reader-jump-flash");
            setTimeout(() => el.classList.remove("reader-jump-flash"), 2400);
          }
        });
        return;
      }
      // If items are still loading and empty, wait for them — don't mark as
      // positioned yet. Once items populate, this effect re-runs and finds it.
      if (items.length === 0) return;
      // Item not found after load — try direct DOM fallback for robustness.
      hasPositionedRef.current = true;
      requestAnimationFrame(() => {
        const el = document.getElementById(`feed-item-${targetNoteId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("reader-jump-flash");
          setTimeout(() => el.classList.remove("reader-jump-flash"), 2400);
        }
      });
      return;
    }
    // No deep link — need at least some items before choosing default target.
    if (items.length === 0) return;
    hasPositionedRef.current = true;
    // Default: first item whose passage is in the reader's current chapter —
    // `items` may be sorted by activity/engagement now rather than book
    // order, so this is a search, not just "the first group" the way it
    // was when chapters were their own sections.
    const target = items.find((item) => item.kind === "highlight" && item.entry.sectionId === activeSectionId);
    if (!target) return;
    requestAnimationFrame(() => {
      document.getElementById(feedItemElementId(target))?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  }, [items, targetNoteId, activeSectionId, focusedAuthor]);

  // Narrowing to someone else from the header starts their notes at the top.
  const focusedId = focusedAuthor?.author.readerId;
  const listTopRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusedId) listTopRef.current?.scrollIntoView({ block: "start" });
  }, [focusedId]);

  return (
    <PanelShell
      panelType={panelType}
      onClose={onClose}
      // Adds overflow-x-hidden on top of PanelShell's own default body
      // class — this panel's own content should never need to scroll
      // sideways, but `overflow-y-auto` alone (the default) leaves
      // overflow-x at its own computed value, which the CSS spec forces to
      // `auto` too the moment overflow-y isn't `visible`. Any stray
      // horizontal overflow (a single pixel of rounding from
      // FeedItemLabel's own -mx-5 bleed is enough) was silently growing a
      // second, sand-colored (.om-scroll's own scrollbar-thumb color)
      // horizontal scrollbar across the bottom of the list — the "weird
      // background" band sitting above the footer composer.
      bodyClassName={
        onNotes
          ? "flex min-h-0 flex-1 flex-col"
          : "om-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-5 pb-10 flex flex-col gap-3.5"
      }
      // The book, headed as its page heads it; the title opens its info.
      title={
        <button
          type="button"
          onClick={() => book && router.push(`/library/${book.slug}?tab=info`)}
          className="flex min-w-0 cursor-pointer items-center gap-2.5 border-none bg-transparent p-0 text-left"
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-bold text-[var(--reader-text)]">{book?.title ?? "\u00a0"}</span>
          </span>
        </button>
      }
      headerMenu={
        narrowed ? (
          <button
            type="button"
            onClick={onClearAuthor}
            className="cursor-pointer rounded-full px-2 py-1 text-[12px] font-semibold text-[var(--reader-accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--reader-accent)_12%,transparent)]"
          >
            All notes
          </button>
        ) : undefined
      }
      divided
    >
      {onNotes ? (
        <BookRoomPane materialId={materialId} authorId={focusedAuthor?.author.readerId} targetNoteId={targetNoteId ?? targetThreadId} onPassage={onPassage} locate={locate} getPassageText={getPassageText} />
      ) : (
        <>
          {focusedAuthor && (
            <div
              ref={listTopRef}
              className="reader-menu-in mt-3 flex items-center gap-2.5 rounded-full bg-[color-mix(in_srgb,var(--reader-accent)_10%,transparent)] py-1 pl-1 pr-1.5"
            >
              <ReaderAvatar pseudonym={focusedAuthor.author.pseudonym} avatar={focusedAuthor.author.avatar} size={26} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--reader-text-muted)]">
                <span className="font-semibold text-[var(--reader-text)]">{comradeName(focusedAuthor.author.pseudonym)}</span>
                {" · "}
                {notesLabel(focusedAuthor.count)}
              </span>
              <button
                type="button"
                onClick={onClearAuthor}
                className="flex flex-none cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold text-[var(--reader-accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--reader-accent)_12%,transparent)]"
              >
                All notes
                <X size={13} strokeWidth={2.5} />
              </button>
            </div>
          )}
          {items.length === 0 ? (
            <NoResults className="mt-5 text-center" message="No highlights" />
          ) : (
            // pt-4 — PanelShell's own body has no top padding by default (its
            // bottom padding is for scroll clearance above the footer, not a
            // symmetric pair), so without this the first run's label sits
            // flush against the subheader's own bottom border with no breathing
            // room at all.
            <div className="flex flex-col pt-4">
              {runs.map((run, runIndex) => (
                <div key={run.key} className={runIndex === 0 ? undefined : "mt-6"}>
                  <FeedItemLabel run={run} filter={filter} />
                  {/* Items within the same run sit closer together (gap-4)
                      than the space reserved above the next run (mt-6 on the
                      wrapper above) — same "tighter within a group, looser
                      between groups" convention as the general run's own
                      spacing before it was flattened here. */}
                  <div className="flex flex-col gap-4">
                    {run.items.map((item) => (
                      <div key={feedItemElementId(item)} id={feedItemElementId(item)}>
                        {item.kind === "highlight" ? (
                          <FeedHighlightThread
                            materialId={materialId}
                            entry={item.entry}
                            getPassageText={getPassageText}
                            onJump={onJump}
                            targetThreadId={targetThreadId}
                          />
                        ) : (
                          <GeneralNoteThread
                            materialId={materialId}
                            note={item.note}
                            allNotes={notes}
                            initialShowAll={targetNoteId === item.note.id || targetThreadId === item.note.id}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </PanelShell>
  );
}

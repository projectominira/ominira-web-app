"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronUp } from "lucide-react";
import type { Note } from "@/lib/api/types";
import { collapsedStart, threadOrder, type ThreadEntry } from "@/lib/community/threadOrder";

/** A note's replies as a tree, wherever a thread shows (the reader's
 * NoteThreadCard, a room's NoteBubble): a trunk drops from the note's 32px
 * avatar (left-[15px]) and a rounded elbow branches into each reply's avatar,
 * ending at the last. Replies come grouped by what they answer
 * (threadOrder); a nested reply gets a longer elbow, never a second trunk,
 * so the indent can't compound at phone width. Collapsed, the latest `keep`
 * show, with the earlier ones behind "Show N earlier replies" at the top of
 * the trunk, where they'd be. Each entry is the caller's (`render`),
 * composer included, so a reply box opens right under what it answers. */
export default function ThreadReplies({
  replies,
  avatar,
  keep,
  all,
  onShowAll,
  focusId,
  viewerId,
  render,
}: {
  /** Chronological. */
  replies: Note[];
  /** The replies' avatar size, where each elbow lands. */
  avatar: number;
  keep: number;
  all: boolean;
  onShowAll: () => void;
  /** A deep-linked reply: scrolled to and washed once. */
  focusId?: string;
  /** Given (rooms), others' replies arriving while it's open wash once. */
  viewerId?: string | null;
  render: (entry: ThreadEntry) => ReactNode;
}) {
  const entries = threadOrder(replies);
  const start = all ? 0 : collapsedStart(entries, keep);
  const shown = entries.slice(start);
  // What was here when it opened: anything after is news.
  const [initial] = useState(() => new Set(replies.map((r) => r.id)));
  const focusRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // "center": flush against the top it reads as the thread's beginning.
    if (focusId) focusRef.current?.scrollIntoView({ block: "center" });
  }, [focusId]);

  if (shown.length === 0) return null;
  return (
    <ul role="list" aria-label={`${replies.length} ${replies.length === 1 ? "reply" : "replies"}`} className="m-0 flex list-none flex-col gap-3 p-0">
      {start > 0 && (
        <li className="relative pl-8 sm:pl-10">
          <span className="absolute -bottom-3 left-[15px] top-0 w-px bg-[var(--reader-thread-line)]" aria-hidden="true" />
          <button
            type="button"
            onClick={onShowAll}
            className="flex min-h-9 cursor-pointer items-center gap-1.5 text-xs font-semibold text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]"
          >
            <ChevronUp size={14} aria-hidden="true" />
            Show {start} earlier {start === 1 ? "reply" : "replies"}
          </button>
        </li>
      )}
      {shown.map((entry, i) => {
        const { reply, depth } = entry;
        const branch = depth === 1;
        const wash =
          reply.id === focusId
            ? "bg-[color-mix(in_srgb,var(--reader-accent)_8%,transparent)]"
            : viewerId !== undefined && !initial.has(reply.id) && reply.author.readerId !== viewerId
              ? "thread-wash"
              : "";
        return (
          <li
            key={reply.id}
            ref={reply.id === focusId ? focusRef : undefined}
            className={`relative pl-8 sm:pl-10 ${branch ? "pt-3" : ""}`}
          >
            {/* The trunk, through this entry and the gap below; the last
                one's elbow is where it ends. */}
            {i < shown.length - 1 && <span className="absolute -bottom-3 left-[15px] top-0 w-px bg-[var(--reader-thread-line)]" aria-hidden="true" />}
            {/* Down to the avatar's center (past the branch's pt-3), across
                to its left edge, 3px short. */}
            <span
              style={{ height: (branch ? 12 : 0) + avatar / 2 }}
              className={`absolute left-[15px] top-0 rounded-bl-md border-b border-l border-[var(--reader-thread-line)] ${
                branch ? "w-[14px] sm:w-[22px]" : "w-[30px] sm:w-[46px]"
              }`}
              aria-hidden="true"
            />
            <div className={`min-w-0 ${branch ? "" : "pl-4 sm:pl-6"}`}>
              <div className={wash && `-mx-2 rounded-sm px-2 ${wash}`}>{render(entry)}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

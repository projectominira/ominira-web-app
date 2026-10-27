"use client";

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { useRouter } from "next/navigation";
import { dayLabel } from "@/lib/rooms/days";
import type { NoteVisibility } from "@/lib/api/types";
import type { RoomItem, RoomNote, RoomSession } from "@/lib/rooms/types";
import { useNow } from "@/lib/time/useNow";
import type { LocalDay } from "@/lib/time/zone";
import { NOTE_PIN, PASSAGE_PIN } from "@/lib/rooms/timeline";
import { MilestoneCard, SessionCard, TargetCard } from "./ActionCards";
import { HighlightCard } from "./Highlights";
import NoteBubble, { type BubbleState } from "./NoteBubble";
import Loader from "@/app/components/Loader";
import SystemLine, { DayDivider, RepliedLine, UnreadDivider } from "./SystemLine";

// The stream shell every room shares (rooms-spec §2, 4a / 7a–7c): the
// header and pinned bar on top, the stream newest at the bottom, the input
// pinned below. Older pages load as you scroll up, without the stream
// jumping. A room you left opens at the unread divider; "New" / "Latest"
// takes you back down.

/** How close to the bottom counts as "at the bottom" (Room.dc.html). */
const AT_BOTTOM = 48;
/** How close to the top asks for the page before. */
const NEAR_TOP = 240;
const FLASH_MS = 1600;

export type RoomStreamHandle = {
  /** Scrolls to a card ("target", a session or note id) and rings it. */
  /** False when the anchor isn't loaded. */
  jumpTo: (anchor: string, last?: boolean) => boolean;
  toBottom: () => void;
};

export type StreamHandlers = {
  /** The fist on a note, or on one of its replies. */
  onReact?: (n: RoomNote, replyId?: string) => void;
  onPassage?: (n: RoomNote) => void;
  /** A reply under a note (`to`: the reply it answers); absent signed out. */
  onReply?: (n: RoomNote, reply: { text: string; mentions: string[] }, to?: string) => void;
  /** Deletes a note or one of its replies (yours, or any as a moderator). */
  onDelete?: (n: RoomNote, replyId?: string) => void;
  onRetry?: (n: RoomNote) => void;
  /** Pins a note to the room's strip, or unpins it (a group's moderators). */
  onPin?: (n: RoomNote, pin: boolean) => void;
  /** The same for this week's target and a scheduled session; `pins` says
   * what's pinned (a session by its series id, else its id). */
  onPinTarget?: (pin: boolean) => void;
  onPinSession?: (session: RoomSession["session"], pin: boolean) => void;
  pins?: { note: string | null; target: boolean; session: string | null };
  onRemind?: () => void;
  onStart?: () => void;
  onEditSession?: () => void;
  onJoin?: () => void;
  /** The target card's foot: your progress and the book's resume buttons. */
  resume?: ReactNode;
  /** Your highlight made public or private. */
  onHighlightVisibility?: (id: string, visibility: NoteVisibility) => void;
  /** Your highlight deleted (after asking). */
  onHighlightDelete?: (id: string) => void;
  /** A highlight's line opened; absent, it's a link to the reader. */
  onHighlight?: (item: Extract<RoomItem, { t: "highlight" }>) => void;
};

const itemKey = (it: RoomItem, i: number) =>
  it.t === "note" ? it.note.note.id : it.t === "replied" ? `replied-${it.replied.id}` : it.t === "system" || it.t === "joins" || it.t === "highlight" ? it.id : it.t === "session" ? it.card.session.id : it.t === "day" ? `day-${it.day}` : `${it.t}-${i}`;

export default function RoomStream({
  ref,
  items,
  viewerId,
  today,
  team = false,
  loading = false,
  states = {},
  hasOlder = false,
  onLoadOlder,
  onReadToBottom,
  header,
  pinned,
  overlay,
  input,
  footer,
  bodyClassName = "gap-4 px-4 pt-5 pb-6",
  empty = "Ask a question. Share a reflection. Invite a comrade.",
  maxWidth,
  handlers = {},
  children,
}: {
  ref?: Ref<RoomStreamHandle>;
  /** Oldest first. */
  items: RoomItem[];
  viewerId: string | null;
  /** The viewer's day, for the day dividers. */
  today: LocalDay;
  /** Moderators: Start and Edit on the cards, Remove on notes. */
  team?: boolean;
  loading?: boolean;
  /** Notes on their way: sending, or failed with Retry. */
  states?: Record<string, BubbleState>;
  hasOlder?: boolean;
  onLoadOlder?: () => void;
  /** Read to the bottom: room_reads (2.4) debounces it. */
  onReadToBottom?: () => void;
  header?: ReactNode;
  pinned?: ReactNode;
  /** Over the top of the stream, under `pinned` (a book's reading strip). */
  overlay?: ReactNode;
  /** In the room's input bar; `footer` instead goes below the stream as it
   * is (the reader's NoteWriter bar brings its own). */
  input?: ReactNode;
  footer?: ReactNode;
  /** The stream's gap and padding (the reader's panel is roomier). */
  bodyClassName?: string;
  /** The empty room's second line. */
  empty?: string;
  /** Desktop caps the stream and input (720 px, spec §2). */
  maxWidth?: number;
  handlers?: StreamHandlers;
  /** What follows the items in the stream: a thread as a screen of its
   * own (the passage's, 3e) is its replies. */
  children?: ReactNode;
}) {
  const now = useNow();
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState<string | null>(null);
  // The replied lines already opened: gone at once, not on the next read.
  const [openedLines, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The first item and the height before a render: if items arrive above,
  // the stream stays where the reader is.
  const before = useRef<{ first: string | null; height: number; top: number }>({ first: null, height: 0, top: 0 });
  const opened = useRef(false);
  const first = items.length ? itemKey(items[0], 0) : null;
  const lastAt = items.length - 1;
  const last = items.length ? itemKey(items[lastAt], lastAt) : null;
  // A new message at the bottom: yours always brings the stream down to it,
  // anyone's does while you're at the bottom (as a chat does).
  const atBottom = useRef(true);
  const lastSeen = useRef(last);
  const lastItem = items[lastAt];
  const lastMine = lastItem?.t === "note" && lastItem.note.note.author.readerId === viewerId;

  const toBottom = useCallback((smooth = true) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const jumpTo = useCallback((anchor: string, last = false) => {
    const el = scroller.current;
    const all = el?.querySelectorAll<HTMLElement>(`[data-anchor="${CSS.escape(anchor)}"]`);
    const target = all && (last ? all[all.length - 1] : all[0]);
    if (!el || !target) return false;
    el.scrollTo({ top: Math.max(0, target.offsetTop - 16), behavior: "smooth" });
    clearTimeout(flashTimer.current);
    setFlash(anchor);
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
    return true;
  }, []);
  useImperativeHandle(ref, () => ({ toBottom, jumpTo }), [toBottom, jumpTo]);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  // Opening: at the unread divider when there is one, else the bottom.
  // Later, older pages keep the reader's place.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || loading) return;
    if (!opened.current) {
      opened.current = true;
      const divider = el.querySelector<HTMLElement>('[data-anchor="unread"]');
      el.scrollTop = divider ? divider.offsetTop - 8 : el.scrollHeight;
    } else if (before.current.first !== first && before.current.height) {
      el.scrollTop = before.current.top + (el.scrollHeight - before.current.height);
    } else if (last !== lastSeen.current && (lastMine || atBottom.current)) {
      toBottom();
    }
    lastSeen.current = last;
    before.current = { first, height: el.scrollHeight, top: el.scrollTop };
  }, [first, last, lastMine, loading, items.length, toBottom]);

  const onScroll = () => {
    const el = scroller.current!;
    before.current = { first, height: el.scrollHeight, top: el.scrollTop };
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < AT_BOTTOM;
    atBottom.current = bottom;
    if (bottom) onReadToBottom?.();
    if (hasOlder && el.scrollTop < NEAR_TOP) onLoadOlder?.();
  };

  const h = handlers;
  const render = (it: RoomItem, i: number): ReactNode => {
    switch (it.t) {
      case "day":
        return (
          <div key={itemKey(it, i)} className="pt-2 pb-0.5">
            <DayDivider label={dayLabel(it.day, today)} />
          </div>
        );
      case "unread":
        return <UnreadDivider key="unread" count={it.count} />;
      case "replied": {
        // A note not loaded yet opens on its own page.
        const id = it.replied.id;
        if (openedLines.has(id)) return null;
        const open = () => {
          setOpened((s) => new Set(s).add(id));
          if (!jumpTo(id)) router.push(`/note/${id}`);
        };
        return <RepliedLine key={itemKey(it, i)} replied={it.replied} viewerId={viewerId} onOpen={open} />;
      }
      case "system":
      case "joins":
        return <SystemLine key={itemKey(it, i)} item={it} />;
      case "milestone":
        return <MilestoneCard key={it.milestone.id} item={it} />;
      case "target":
        return (
          <div key="target" data-anchor="target" className="flex justify-center">
            <div className="w-full max-w-95">
              <TargetCard
                target={it.target}
                flash={flash === "target"}
                resume={h.resume}
                pin={h.onPinTarget && { pinned: !!h.pins?.target, onToggle: h.onPinTarget }}
              />
            </div>
          </div>
        );
      case "session": {
        const id = it.card.session.id;
        return (
          <div key={`${id}-${it.card.state}`} data-anchor={id} className="flex justify-center">
            <div className="w-full max-w-95">
              <SessionCard
                card={it.card}
                team={team}
                viewerId={viewerId}
                flash={flash === id}
                onRemind={h.onRemind}
                onStart={h.onStart}
                onEdit={h.onEditSession}
                onJoin={h.onJoin}
                pin={
                  h.onPinSession && {
                    pinned: h.pins?.session === (it.card.session.seriesId ?? id),
                    onToggle: (pin) => h.onPinSession!(it.card.session, pin),
                  }
                }
              />
            </div>
          </div>
        );
      }
      case "note": {
        // The note's "Pinned" follows the pins (they change at once); the
        // passage of the day keeps its own label.
        const pinned = h.pins && it.note.pinned !== PASSAGE_PIN ? (h.pins.note === it.note.note.id ? NOTE_PIN : null) : it.note.pinned;
        const n = pinned === it.note.pinned ? it.note : { ...it.note, pinned };
        return (
          <div key={n.note.id} data-anchor={n.note.id} className="mx-auto w-full shell:max-w-[560px]">
            <NoteBubble
              note={n}
              viewerId={viewerId}
              now={now}
              state={states[n.note.id]}
              flash={flash === n.note.id}
              moderator={team}
              handlers={{
                onReact: (replyId) => h.onReact?.(n, replyId),
                onReply: h.onReply && ((reply, to) => h.onReply!(n, reply, to)),
                onDelete: h.onDelete && ((replyId) => h.onDelete!(n, replyId)),
                onPin: h.onPin && ((pin) => h.onPin!(n, pin)),
              }}
              onPassage={() => h.onPassage?.(n)}
              onRetry={() => h.onRetry?.(n)}
            />
          </div>
        );
      }
      case "empty":
        return (
          <div key="empty" className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <span className="font-serif text-[17px]/[1.35] font-semibold text-balance">No one’s here yet — start the thread.</span>
            <span className="max-w-75 text-ui-body-regular text-pretty text-[var(--color-app-text-secondary)]">{empty}</span>
          </div>
        );
      case "highlight":
        return (
          <div key={it.id} data-anchor={it.id} className="mx-auto w-full shell:max-w-[560px]">
            <HighlightCard
              item={it}
              viewerId={viewerId}
              now={now}
              flash={flash === it.id}
              onVisibility={h.onHighlightVisibility && ((v) => h.onHighlightVisibility!(it.id, v))}
              onDelete={h.onHighlightDelete && (() => h.onHighlightDelete!(it.id))}
              onOpen={h.onHighlight && (() => h.onHighlight!(it))}
            />
          </div>
        );
    }
  };

  const cap = maxWidth ? { maxWidth } : undefined;
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-[var(--reader-bg)] text-[var(--color-app-text)]">
      {/* A book's header unfolds in place, up to 72 % of the room, then scrolls. */}
      {header && <div className="flex max-h-[72%] flex-none flex-col border-b border-[var(--color-app-border)] bg-[var(--reader-bg)]">{header}</div>}
      {pinned}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div ref={scroller} onScroll={onScroll} className="relative h-full overflow-y-auto bg-[var(--color-app-canvas)]">
          <div style={cap} className={`mx-auto flex min-h-full flex-col justify-end ${bodyClassName}`}>
            {!loading && items.map(render)}
            {!loading && children}
          </div>
        </div>
        {overlay}
        {loading && <Loader confined />}
      </div>
      {input && (
        <div className="flex-none border-t border-[var(--color-app-border)] bg-[var(--reader-bg)] px-3 py-2.5 max-md:px-1 max-md:py-1">
          <div style={cap} className="mx-auto">
            {input}
          </div>
        </div>
      )}
      {footer}
    </div>
  );
}

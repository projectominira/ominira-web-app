"use client";

import { useState } from "react";
import { CircleAlert, Clock, Ellipsis, Lock, RotateCcw } from "lucide-react";
import NoteContent from "@/app/components/reader/notes/NoteContent";
import OverflowMenu, { type OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";
import PulseDot from "@/app/components/shared/PulseDot";
import type { Note } from "@/lib/api/types";
import { isTempId } from "@/lib/api/optimisticId";
import { noteMentionNames } from "@/lib/community/mentionNames";
import { chapterLabel } from "@/lib/groups/copy";
import { chatTime } from "@/lib/rooms/home";
import { OFFICIAL_TAG, personName } from "@/lib/rooms/names";
import type { RoomNote } from "@/lib/rooms/types";
import FistReaction, { ReplyPill } from "./FistReaction";
import { noteMenu } from "./noteMenu";
import PassageQuote, { passageCite } from "./PassageQuote";
import RoomAvatar from "./RoomAvatar";
import RoomInput from "./RoomInput";
import ThreadReplies from "@/app/components/reader/notes/ThreadReplies";

/** Where a note is on its way to the server: faded while sending, Retry
 * once it failed. */
export type BubbleState = "sent" | "sending" | "failed";

const ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;
/** Replies shown before "Show all": the latest ones. */
const SHOWN = 3;

/** ⋯ and its menu; nothing when there's nothing in it. */
function Menu({ items, small = false }: { items: OverflowMenuItem[]; small?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div className="relative -my-2 -mr-2 flex-none">
      <button
        type="button"
        aria-label="More"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex cursor-pointer items-center justify-center rounded-sm text-[var(--color-app-text-muted)] hover:bg-sand-75 ${small ? "size-9" : "size-11"}`}
      >
        <Ellipsis size={small ? 16 : 18} {...ICON} />
      </button>
      {open && (
        <OverflowMenu
          onClose={() => setOpen(false)}
          items={items.map((it) => ({
            ...it,
            onClick: () => {
              setOpen(false);
              it.onClick();
            },
          }))}
        />
      )}
    </div>
  );
}

/** What happens to a note and its replies; absent ones aren't offered. */
export type NoteHandlers = {
  /** The fist on the note, or on one of its replies. */
  onReact?: (replyId?: string) => void;
  /** A reply under the note; `to` is the reply it answers. Signed out, absent. */
  onReply?: (reply: { text: string; mentions: string[] }, to?: string) => void;
  /** Deleting the note, or one of its replies (after asking). */
  onDelete?: (replyId?: string) => void;
};

/**
 * A note in a room: full width, the author and time with ⋯, then the
 * quote, the body, the fist and Reply. Its replies hang off it as a tree
 * (ThreadReplies), grouped by what they answer, the latest three until
 * "Show N earlier"; Reply (on the note or on a reply) opens one box right
 * under it.
 * ⋯ is Delete on your own (Remove for a group's moderators). Kept: a
 * private note is dashed, "Only you", and can't be reacted to; the pin's
 * label, the author tag, sending, failed and Retry, "replying now" and
 * "Also in". `showBook` (outside its room) adds "in {book}".
 */
export default function NoteBubble({
  note: n,
  viewerId,
  state = "sent",
  now,
  showBook = false,
  moderator = false,
  handlers = {},
  onPassage,
  onBook,
  onRetry,
  flash = false,
}: {
  note: RoomNote;
  viewerId: string | null;
  state?: BubbleState;
  /** The stream's clock, for "14m" (one `useNow` per stream, not per bubble). */
  now: number;
  showBook?: boolean;
  /** A group's moderator: Remove on anyone's note. */
  moderator?: boolean;
  handlers?: NoteHandlers;
  /** Just jumped to: a brief brand ring. */
  flash?: boolean;
  /** Opens the quoted passage in the reader. */
  onPassage?: () => void;
  /** Opens the note's book ("in {book}"); the passage when not given. */
  onBook?: () => void;
  onRetry?: () => void;
}) {
  const { note } = n;
  const { onReact, onReply, onDelete } = handlers;
  const [all, setAll] = useState(false);
  // Replying: to the note (its id) or to one reply; null while closed.
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const mine = note.author.readerId === viewerId;
  const official = n.authorTag === OFFICIAL_TAG;
  const priv = note.visibility === "private";
  const pending = state !== "sent";
  const actions = !priv && !pending;
  const text = note.content.kind === "voice" || note.content.text.trim() !== "";
  const book = showBook && n.material;
  const replies = n.replies;
  const nameOf = (r: Note) => (r.author.readerId === viewerId ? "You" : personName(r.author.pseudonym));
  // The one reply box, right under what it answers (`to`: a reply's id).
  const composer = (to: string | undefined, whom: string) =>
    onReply && (
      <RoomInput
        autoFocus
        placeholder={`Reply to ${whom}`}
        onSend={(reply) => {
          onReply(reply, to);
          setReplyTo(null);
          setAll(true);
        }}
      />
    );

  return (
    <div className={`flex w-full flex-col gap-1 ${state === "sending" ? "opacity-60" : ""}`}>
      <article
        className={`flex w-full flex-col gap-3 rounded-sm border px-4 pt-3 pb-3.5 transition-shadow duration-250 ease-out ${flash ? "ring-3 ring-brand-300" : ""} ${
          priv ? "border-dashed border-sand-300 bg-white" : "border-[var(--color-app-border)] bg-white"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <RoomAvatar comrade={note.author} size={32} official={official} />
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <span className="min-w-0 truncate text-ui-sm font-bold text-[var(--reader-text)]">{mine ? "You" : personName(note.author.pseudonym, official)}</span>
              {n.authorTag && (
                <span className="flex-none self-center rounded-xs bg-sand-100 px-1.5 py-px font-sans text-[10px]/[1.4] font-bold whitespace-nowrap text-[var(--color-app-text-secondary)]">
                  {n.authorTag}
                </span>
              )}
              <span className="min-w-0 flex-none truncate text-[12px] font-semibold text-[var(--reader-text-muted)]">
                {pending ? "now" : chatTime(note.createdAt, now)}
                {note.author.city && ` · ${note.author.city}`}
              </span>
              {priv && (
                <span className="flex flex-none items-center gap-0.5 self-center text-[11px] font-semibold text-[var(--reader-text-subtle)]">
                  <Lock size={9} aria-hidden />
                  Only you
                </span>
              )}
            </div>
            {book && (
              <button
                type="button"
                onClick={onBook ?? onPassage}
                className="max-w-full cursor-pointer self-start truncate text-left text-ui-caption text-[var(--color-app-text-secondary)]"
              >
                in <span className="font-serif text-[13px] text-[var(--color-app-text)] italic">{book.title}</span>
              </button>
            )}
          </div>
          {!pending && onDelete && <Menu items={noteMenu(note, viewerId, moderator, replies.length, () => onDelete())} />}
        </div>

        {n.pinned && (
          <span className="inline-flex items-center gap-1.5 self-start font-sans text-[11px]/[1.3] font-extrabold tracking-eyebrow text-[var(--color-app-brand)] uppercase">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/ominira-mark.png" alt="" className="size-4 object-contain" />
            {n.pinned}
          </span>
        )}
        {n.excerpt && <PassageQuote excerpt={n.excerpt} cite={passageCite(n.material, n.label && chapterLabel(n.label))} onClick={onPassage} />}
        {n.question && <span className="font-serif text-[16px]/[1.4] font-semibold text-pretty">{n.question}</span>}
        {text && <NoteContent content={note.content} mentions={noteMentionNames(note)} variant="card" />}

        {actions && (
          <div className="flex items-center gap-3.5">
            <FistReaction count={note.reactionCount} on={note.reactedByMe} onToggle={() => onReact?.()} />
            {onReply && <ReplyPill count={0} onClick={() => setReplyTo(replyTo === note.id ? null : note.id)} />}
          </div>
        )}
        {actions && replyTo === note.id && composer(undefined, mine ? "your note" : personName(note.author.pseudonym, official))}
        {n.replyingNow > 0 && (
          <div className="flex items-center gap-1.75 font-sans text-[12px]/[1.3] font-bold text-forest-500">
            <PulseDot tone="forest" />
            {n.replyingNow} comrade{n.replyingNow === 1 ? "" : "s"} replying now
          </div>
        )}

        {actions && (
          <ThreadReplies
            replies={replies}
            avatar={26}
            keep={SHOWN}
            all={all}
            onShowAll={() => setAll(true)}
            viewerId={viewerId}
            render={({ reply: r, to }) => {
              const sending = isTempId(r.id);
              return (
                <>
                  <div className={`flex gap-2.5 ${sending ? "opacity-60" : ""}`}>
                    <RoomAvatar comrade={r.author} size={26} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex min-w-0 items-baseline gap-1.5">
                        <span className="min-w-0 truncate text-ui-caption font-bold">{nameOf(r)}</span>
                        {to && <span className="min-w-0 truncate text-ui-caption text-[var(--color-app-text-muted)]">to {nameOf(to)}</span>}
                        <span className="flex-none text-[12px] font-semibold text-[var(--reader-text-muted)]">{sending ? "now" : chatTime(r.createdAt, now)}</span>
                        <span className="flex-1" />
                        {!sending && onDelete && <Menu small items={noteMenu(r, viewerId, moderator, 0, () => onDelete(r.id))} />}
                      </div>
                      <NoteContent content={r.content} mentions={noteMentionNames(r)} variant="card" />
                      {!sending && (
                        <div className="mt-1 flex items-center gap-3">
                          <FistReaction size="sm" count={r.reactionCount} on={r.reactedByMe} onToggle={() => onReact?.(r.id)} />
                          {onReply && (
                            <button
                              type="button"
                              aria-expanded={replyTo === r.id}
                              onClick={() => setReplyTo(replyTo === r.id ? null : r.id)}
                              className="min-h-8 cursor-pointer text-ui-caption font-bold text-[var(--color-app-text-secondary)] hover:text-[var(--color-app-text)]"
                            >
                              Reply
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {replyTo === r.id && <div className="pt-3">{composer(r.id, r.author.readerId === viewerId ? "your reply" : nameOf(r))}</div>}
                </>
              );
            }}
          />
        )}
      </article>

      {state === "sending" && (
        <div className="flex items-center gap-1.5 text-ui-caption text-[var(--color-app-text-muted)]">
          <Clock size={13} {...ICON} />
          Sending…
        </div>
      )}
      {state === "failed" && (
        <div className="flex items-center gap-2 font-sans text-[12px]/[1.3] font-bold text-brand-700">
          <CircleAlert size={15} {...ICON} />
          <span>Not sent</span>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full border border-brand-500 bg-[var(--color-app-surface)] px-3.5 font-sans text-[13px]/none font-extrabold text-[var(--color-app-brand)]"
          >
            <RotateCcw size={14} {...ICON} />
            Retry
          </button>
        </div>
      )}
      {n.alsoIn && <span className="text-ui-caption text-[var(--color-app-text-muted)]">Also in {n.alsoIn}</span>}
    </div>
  );
}

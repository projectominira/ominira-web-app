"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDown, X } from "lucide-react";
import { RoomField, hasKeyboard } from "@/app/components/rooms/RoomInput";
import ReaderAvatar from "@/app/components/shared/ReaderAvatar";
import QuoteCard from "@/app/components/reader/notes/QuoteCard";
import NoteBubble from "@/app/components/rooms/NoteBubble";
import { useAuthor, useNoteThread } from "@/lib/rooms/hooks";
import { pendingNote } from "@/lib/rooms/timeline";
import type { RoomNote } from "@/lib/rooms/types";
import { useSessionStore } from "@/stores/session-store";
import { formatShortTimeAgo } from "@/lib/time/relative";
import { useRoom } from "@/lib/room/hooks";
import type { ChatItem, ChatPerson } from "@/lib/room/chat";
import { MAX_CHAT_LENGTH } from "@/lib/room/events";
import { useSendPassage } from "@/lib/room/sharePassage";
import { useNow } from "@/lib/time/useNow";
import { useRoomStore } from "@/stores/room-store";

// The room's chat, the room panel's Chat view (spec §1.4, §3.2): the
// notice first, then messages, shared passages and reaction digests as
// they come, and the composer over the panel's controls. Loaded with the
// room's UI, only while you're in a room.

/** Within this of the bottom, you're at the end: new lines keep you there. */
const PINNED_PX = 80;

export function RoomChatList() {
  const chat = useRoom((s) => s.chat);
  const me = useRoom((s) => s.readerId);
  const session = useRoomStore((s) => s.session);
  const now = useNow(30_000);
  const endRef = useRef<HTMLDivElement>(null);
  const last = chat?.items.at(-1);
  // The newest line's time: still moves once the list is full (MAX_CHAT_ITEMS).
  const lastAt = last?.at ?? 0;
  // Only someone else's message is news; your own takes you to the end.
  const othersAt = chat?.items.findLast((i) => i.kind === "message" && i.readerId !== me)?.at ?? 0;
  const othersAtRef = useRef(othersAt);
  // Whether the end of the chat is on screen. Not at first, so opening the
  // tab doesn't jump past who's here.
  const [atEnd, setAtEnd] = useState(false);
  const atEndRef = useRef(false);
  // The newest message from someone else you'd seen when you left the end.
  const [seenAt, setSeenAt] = useState(othersAt);

  // On screen: nothing is unread.
  useEffect(() => {
    session?.setChatViewing(true);
    return () => session?.setChatViewing(false);
  }, [session]);

  useEffect(() => {
    const end = endRef.current;
    const root = end?.closest<HTMLElement>(".om-scroll");
    if (!end || !root) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        atEndRef.current = entry.isIntersecting;
        setAtEnd(entry.isIntersecting);
        setSeenAt(othersAtRef.current);
      },
      { root, rootMargin: `0px 0px ${PINNED_PX}px 0px` },
    );
    io.observe(end);
    return () => io.disconnect();
  }, []);

  const mine = last?.kind === "message" && last.readerId === me;
  useLayoutEffect(() => {
    othersAtRef.current = othersAt;
    const scroller = endRef.current?.closest<HTMLElement>(".om-scroll");
    if (scroller && (atEndRef.current || mine)) scroller.scrollTop = scroller.scrollHeight;
  }, [lastAt, othersAt, mine]);

  if (!chat) return null;
  return (
    <div className="flex flex-col gap-4">
      {chat.items.length === 0 ? (
        <p className="m-0 py-2 text-[13px] text-[var(--reader-text-muted)]">Nothing said yet. Say hello to the room.</p>
      ) : (
        chat.items.map((item) =>
          item.kind === "digest" ? (
            <Digest key={item.id} item={item} />
          ) : (
            <Message key={item.id} item={item} person={chat.people[item.readerId]} now={now} />
          ),
        )
      )}
      <div ref={endRef} />
      {/* Away from the end when someone says something: a way down to it. */}
      {!atEnd && othersAt > seenAt && (
        <button
          type="button"
          onClick={() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
          className="reader-face-in sticky bottom-3 flex h-8 cursor-pointer items-center gap-1 self-center rounded-full bg-brand-500 pr-3 pl-2.5 text-xs font-bold text-white shadow-md"
        >
          <ArrowDown size={14} strokeWidth={2.5} />
          New messages
        </button>
      )}
    </div>
  );
}

function Message({
  item,
  person,
  now,
}: {
  item: Extract<ChatItem, { kind: "message" }>;
  person: ChatPerson | undefined;
  now: number;
}) {
  const name = person?.name ?? "A comrade";
  const when = formatShortTimeAgo(item.at, now);
  if (item.sending) return <SendingNote item={item} />;
  if (item.passage?.noteId) return <SharedNote noteId={item.passage.noteId} item={item} />;
  return (
    <div className="flex gap-2.5">
      <ReaderAvatar pseudonym={person?.name ?? "comrade"} avatar={person?.avatar ?? null} size={28} className="flex-none" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline gap-1.5 text-[12px]">
          <span className="truncate font-semibold text-[var(--reader-text)]">
            {name}
          </span>
          <span className="flex-none text-[11px] font-medium text-[var(--reader-text-subtle)]">{when === "now" ? "just now" : `${when} ago`}</span>
        </span>
        {item.passage && (
          <QuoteCard>
            <p className="m-0 font-serif text-[14px] leading-[1.7] text-[var(--color-app-text)]">{item.passage.quote}</p>
            <span className="flex justify-between gap-3 pt-1 pb-2 text-[11px] font-semibold text-[var(--reader-text-subtle)]">
              <span className="min-w-0 truncate">Shared passage{item.passage.label && ` · ${item.passage.label}`}</span>
              <span className="flex-none">Saved as a note</span>
            </span>
          </QuoteCard>
        )}
        <p className="m-0 text-[13px] break-words whitespace-pre-wrap text-[var(--reader-text-muted)]">{item.text}</p>
      </div>
    </div>
  );
}

/** A passage shared to the chat: the note it was saved as, in the same
 * NoteBubble the book's room shows — react and reply as there. */
function SharedNote({ noteId, item }: { noteId: string; item: Extract<ChatItem, { kind: "message" }> }) {
  const viewerId = useSessionStore((s) => s.readerId);
  const now = useNow();
  const { thread, heart, reply, del } = useNoteThread(noteId, () => {});
  const n = thread.data;
  // Yours stays as it was sent until the saved note loads.
  if (!n) return item.readerId === viewerId ? <SendingNote item={item} /> : null;
  return (
    <NoteBubble
      note={n}
      viewerId={viewerId}
      now={now}
      moderator={n.moderator}
      handlers={{
        onReact: (replyId) => viewerId && heart.mutate({ noteId: replyId ?? n.note.id, rootId: n.note.id }),
        onReply: viewerId ? (r, to) => void reply(n.note.id, r, to, n.note.ranges) : undefined,
        onDelete: viewerId ? (replyId) => del.mutate({ noteId: replyId ?? n.note.id, rootId: n.note.id }) : undefined,
      }}
    />
  );
}

/** Your shared passage as it was sent, before its note is saved and loaded. */
function SendingNote({ item }: { item: Extract<ChatItem, { kind: "message" }> }) {
  const author = useAuthor();
  const now = useNow();
  const base = pendingNote(item.id, item.text, author, new Date(item.at).toISOString());
  const note: RoomNote = { ...base, excerpt: item.passage?.quote ?? null, label: item.passage?.label || null, fromReader: true };
  return <NoteBubble note={note} viewerId={author.readerId} now={now} state="sending" />;
}

function Digest({ item }: { item: Extract<ChatItem, { kind: "digest" }> }) {
  return (
    <p className="m-0 flex items-center gap-2 text-xs font-medium text-[var(--reader-text-muted)]">
      <span className="h-px flex-1 bg-[var(--reader-border)]" />
      <span aria-hidden="true">{item.emojis.join(" ")}</span>
      <span className="max-w-[75%] text-center">{item.text}</span>
      <span className="h-px flex-1 bg-[var(--reader-border)]" />
    </p>
  );
}

/** "Message the room" + send, in the panel's footer: the same field every
 * room uses (RoomField). Enter sends (on a phone, the send button). Within 2 s of your last message, it's kept and the
 * rate is explained. A passage shared from the reader waits above the box,
 * and your words go with it: saved as a note, then posted (sharePassage.ts). */
export function RoomChatComposer({ materialId, className = "px-4 pt-2 pb-3" }: { materialId: string; className?: string }) {
  const session = useRoomStore((s) => s.session);
  const passage = useRoomStore((s) => s.passage);
  const clearPassage = useRoomStore((s) => s.clearPassage);
  const sendPassage = useSendPassage(materialId);
  const connecting = useRoom((s) => s.connection === "connecting");
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  // A passage just arrived: write about it.
  useEffect(() => {
    if (passage) inputRef.current?.focus();
  }, [passage]);

  const send = () => {
    if (!session || !text.trim()) return;
    if (!passage) {
      if (session.sendChat(text)) setText("");
      else setNotice(SLOW);
      return;
    }
    if (sendPassage(passage, text) === "sent") {
      setText("");
      clearPassage();
    } else setNotice(SLOW);
  };

  const submit = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || !hasKeyboard()) return;
    e.preventDefault();
    void send();
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {passage && (
        <div className="flex items-start gap-2 rounded-sm border border-[var(--reader-border)] bg-[var(--color-app-surface-muted)] py-2 pr-1.5 pl-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[11px] font-semibold text-[var(--reader-text-subtle)]">
              Sharing passage{passage.label && ` · ${passage.label}`}
            </span>
            <p className="m-0 line-clamp-2 font-serif text-[13px] leading-snug text-[var(--color-app-text)]">{passage.quote}</p>
          </div>
          <button
            type="button"
            onClick={clearPassage}
            aria-label="Don't share this passage"
            title="Don't share"
            className="flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-sm text-[var(--reader-text-muted)] hover:bg-[var(--reader-surface-hover)] hover:text-[var(--reader-text)]"
          >
            <X size={15} strokeWidth={2.25} />
          </button>
        </div>
      )}
      <RoomField
        value={text}
        onChange={setText}
        placeholder={passage ? "Say something about it" : "Message the room"}
        inputRef={inputRef}
        maxLength={MAX_CHAT_LENGTH}
        canSend={!!text.trim() && connecting === false}
        onSend={() => void send()}
        onKeyDown={submit}
      />
      {notice && (
        <p role="status" className="m-0 text-[11px] text-[var(--reader-text-muted)]">
          {notice}
        </p>
      )}
    </div>
  );
}

const SLOW = "One message every 2 seconds. Yours is still here.";


"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import RoomInput from "@/app/components/rooms/RoomInput";
import RoomStream, { type RoomStreamHandle } from "@/app/components/rooms/RoomStream";
import { quoteReaderHref } from "@/app/components/rooms/PassageQuote";
import { roomItems } from "@/lib/rooms/timeline";
import type { RoomItem, RoomNote } from "@/lib/rooms/types";
import { useBookRoom } from "@/lib/rooms/useBookRoom";

/**
 * The reader's Notes tab: the book's room in miniature — the same stream
 * and input as the book's page (BookRoomView), in the panel. `authorId`
 * narrows it to one comrade; `targetNoteId` (a notification's deep link)
 * scrolls to that note once it's loaded.
 */
export default function BookRoomPane({ materialId, authorId, targetNoteId }: { materialId: string; authorId?: string; targetNoteId?: string }) {
  const router = useRouter();
  const { viewerId, stream, send, heart, reply, del, markRead, card, tz, today } = useBookRoom(materialId);
  const handle = useRef<RoomStreamHandle>(null);

  const items = useMemo((): RoomItem[] => {
    const all = roomItems(stream.data?.pages ?? [], {
      tz,
      viewerId,
      cards: card ? [{ ref: card.session.id, item: { t: "session", card } }] : [],
      pending: send.items,
    });
    const shown = authorId ? all.filter((it) => it.t === "note" && it.note.note.author.readerId === authorId) : all;
    return shown.length ? shown : [{ t: "empty" }];
  }, [stream.data, card, send.items, tz, viewerId, authorId]);

  const found = targetNoteId ? items.some((it) => it.t === "note" && it.note.note.id === targetNoteId) : false;
  useEffect(() => {
    if (!targetNoteId || !found) return;
    const id = requestAnimationFrame(() => handle.current?.jumpTo(targetNoteId));
    return () => cancelAnimationFrame(id);
  }, [targetNoteId, found]);

  const openPassage = (n: RoomNote) => {
    const href = quoteReaderHref(n);
    if (href) router.push(href);
  };

  return (
    <RoomStream
      ref={handle}
      items={items}
      viewerId={viewerId}
      today={today}
      loading={stream.isLoading}
      states={send.states}
      hasOlder={stream.hasNextPage}
      onLoadOlder={() => !stream.isFetchingNextPage && void stream.fetchNextPage()}
      onReadToBottom={markRead}
      handlers={{
        onReact: (n, replyId) => viewerId && heart.mutate({ noteId: replyId ?? n.note.id, rootId: n.note.id }),
        onReply: viewerId ? (n, r, to) => void reply(n.note.id, r, to, n.note.ranges) : undefined,
        onDelete: viewerId ? (n, replyId) => del.mutate({ noteId: replyId ?? n.note.id, rootId: n.note.id }) : undefined,
        onRetry: (n) => send.retry(n.note.id),
        onPassage: openPassage,
      }}
      input={
        viewerId ? (
          <RoomInput placeholder="Share a note" onSend={send.send} />
        ) : (
          <button type="button" onClick={() => router.push("/auth/signup")} className="mx-auto flex min-h-12 cursor-pointer items-center justify-center px-4 text-ui-sm font-extrabold text-[var(--color-app-brand)] hover:text-brand-600 disabled:opacity-60">
            Join the conversation
          </button>
        )
      }
    />
  );
}

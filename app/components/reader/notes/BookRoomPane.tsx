"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import RoomInput from "@/app/components/rooms/RoomInput";
import RoomStream, { type RoomStreamHandle } from "@/app/components/rooms/RoomStream";
import { quoteReaderHref } from "@/app/components/rooms/PassageQuote";
import { roomItems } from "@/lib/rooms/timeline";
import { useHighlights } from "@/lib/materials/useHighlights";
import { useProfile } from "@/lib/auth/useProfile";
import { isTempId } from "@/lib/api/optimisticId";
import { quoteForRanges } from "@/lib/reader/annotationSelection";
import type { FeedLocator } from "@/lib/reader/annotationFeed";
import type { AnnotationRange } from "@/lib/api/types";
import type { RoomItem } from "@/lib/rooms/types";
import { useBookRoom } from "@/lib/rooms/useBookRoom";

/**
 * The reader's Notes tab: the book's room in miniature — the same stream
 * and input as the book's page (BookRoomView), in the panel. `authorId`
 * narrows it to one comrade; `targetNoteId` (a notification's deep link)
 * scrolls to that note once it's loaded. A quote opens its passage through
 * `onPassage` (the reader scrolls to it — it only reads ?section= on load,
 * and lights it briefly when it's someone else's); without a section to go
 * to, it follows the link. Your own highlights the stream hasn't caught up
 * with yet (`locate` and `getPassageText` resolve their line) show at once,
 * merged in by time.
 */
export default function BookRoomPane({
  materialId,
  authorId,
  targetNoteId,
  onPassage,
  locate,
  getPassageText,
}: {
  materialId: string;
  authorId?: string;
  targetNoteId?: string;
  /** `mine`: your own mark, already lit in the text. */
  onPassage?: (sectionId: string, ranges: AnnotationRange[], mine: boolean) => void;
  locate?: FeedLocator;
  getPassageText?: (passageId: string) => string;
}) {
  const router = useRouter();
  const { viewerId, stream, send, heart, reply, del, highlightVisibility, highlightDelete, markRead, card, live, liveRoom, tz, today } = useBookRoom(materialId);
  const { data: highlights } = useHighlights(materialId);
  const { data: profile } = useProfile();
  const handle = useRef<RoomStreamHandle>(null);

  const items = useMemo((): RoomItem[] => {
    const pages = stream.data?.pages ?? [];
    const streamed = new Set(pages.flatMap((p) => p.items.flatMap((it) => (it.t === "highlight" ? [it.id] : []))));
    const mine: RoomItem[] =
      locate && getPassageText && profile && viewerId
        ? (highlights ?? []).flatMap((h) => {
            const at = h.ranges[0] && locate(h.ranges[0].passageId);
            if (streamed.has(h.id) || !at) return [];
            const author = { readerId: viewerId, pseudonym: profile.pseudonym, city: profile.city, avatar: profile.avatar };
            const href = `?${new URLSearchParams({ section: at.sectionId, passage: h.ranges[0].passageId })}`;
            const excerpt = quoteForRanges(h.ranges, getPassageText);
            return [{ t: "highlight", id: h.id, author, visibility: h.visibility, excerpt, label: at.label, ranges: h.ranges, href, at: h.createdAt }];
          })
        : [];
    const all = roomItems(pages, {
      tz,
      viewerId,
      cards: card ? [{ ref: card.session.id, item: { t: "session", card } }] : [],
      pending: send.items,
      mine,
    });
    const shown = authorId ? all.filter((it) => it.t === "note" && it.note.note.author.readerId === authorId) : all;
    return shown.length ? shown : [{ t: "empty" }];
  }, [stream.data, card, send.items, tz, viewerId, authorId, highlights, profile, locate, getPassageText]);

  const found = targetNoteId ? items.some((it) => it.t === "note" && it.note.note.id === targetNoteId) : false;
  useEffect(() => {
    if (!targetNoteId || !found) return;
    const id = requestAnimationFrame(() => handle.current?.jumpTo(targetNoteId));
    return () => cancelAnimationFrame(id);
  }, [targetNoteId, found]);

  const open = (href: string | null, ranges: AnnotationRange[], authorId: string) => {
    if (!href) return;
    const section = new URL(href, window.location.origin).searchParams.get("section");
    if (onPassage && section) onPassage(section, ranges, authorId === viewerId);
    else router.push(href);
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
        onPassage: (n) => open(quoteReaderHref(n), n.note.ranges, n.note.author.readerId),
        onHighlight: (it) => open(it.href, it.ranges, it.author.readerId),
        onHighlightVisibility: (id, visibility) => !isTempId(id) && highlightVisibility.mutate({ id, visibility }),
        onHighlightDelete: (id) => !isTempId(id) && highlightDelete.mutate(id),
        // Join (its join screen), or once you're in, Open room: the room's panel.
        onJoin: liveRoom ? () => void live.join(liveRoom.id, liveRoom.title) : undefined,
      }}
      input={
        viewerId ? (
          <RoomInput placeholder="Share a note" canLock onSend={send.send} />
        ) : (
          <button
            type="button"
            onClick={() => router.push("/auth/login")}
            className="mx-auto flex min-h-12 cursor-pointer items-center justify-center px-4 text-ui-sm font-extrabold text-[var(--color-app-brand)] hover:text-brand-600 disabled:opacity-60"
          >
            Join the conversation
          </button>
        )
      }
    />
  );
}

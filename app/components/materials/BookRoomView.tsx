"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Mic } from "lucide-react";
import type { OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";
import { ReadingBar } from "@/app/components/rooms/RoomHeader";
import { useEnterRoom } from "@/lib/room/useEnterRoom";
import { useOpenRoom } from "@/lib/room/useOpenRoom";
import BookRoom from "@/app/components/rooms/BookRoom";
import RoomScreen, { replaceTabParam } from "@/app/components/rooms/RoomScreen";
import { useServerPositionReady } from "@/lib/reader/useServerPositionReady";
import BookDetails from "./BookDetails";
import { readerHref } from "@/app/components/ReaderLink";
import { useBookmarkedMaterialIds, useToggleMaterialBookmark } from "@/lib/bookmarks/useBookmarks";
import { quoteReaderHref } from "@/app/components/rooms/PassageQuote";
import { chapterEnds } from "@/lib/groups/progress";
import type { MaterialDetail } from "@/lib/materials/detail";
import { resolveBookThumbnailSrc } from "@/lib/materials/image";
import { buildResumeHref, positionPercent } from "@/lib/reader/locator";
import { bookHeader, type BookProgress } from "@/lib/rooms/book";
import { roomItems } from "@/lib/rooms/timeline";
import type { RoomItem, RoomNote } from "@/lib/rooms/types";
import RoomInput from "@/app/components/rooms/RoomInput";
import { useBookRoom } from "@/lib/rooms/useBookRoom";
import { useFeedStore } from "@/stores/feed-store";
import { useReadingPositionStore } from "@/stores/reading-position-store";

/**
 * A book's page (rooms-spec §2 Book room, 6a–6c): the room, with Book info
 * over it, open to begin with unless `?tab=room` asks for the room alone
 * (Home's conversations). Server-rendered from the book's facts; the viewer's
 * progress, the stream and the live room load on the client. Join a live
 * reading room (its pinned row or card) and its panel opens here, rather
 * than going to the reader.
 */
export default function BookRoomView({ material, initialInfo }: { material: MaterialDetail; initialInfo: boolean }) {
  const router = useRouter();
  const [infoOpen, setInfoOpen] = useState(initialInfo);
  const showInfo = (open: boolean) => {
    setInfoOpen(open);
    replaceTabParam(open ? "info" : "room");
  };
  // Gates progress and the resume button on the server's position (see the hook).
  const positionReady = useServerPositionReady();
  // A quote opens the reader over the room (the `@modal` overlay).
  const openPassage = (n: RoomNote) => {
    const href = quoteReaderHref(n);
    if (href) router.push(href);
  };
  const { viewerId, stream, send, heart, reply, del, highlightVisibility, highlightDelete, markRead, live, liveRoom, canStart, card, tz, today } = useBookRoom(material.id);
  const position = useReadingPositionStore((s) => s.positions[material.id]);
  const isSaved = useBookmarkedMaterialIds().has(material.id);

  // Opening the room here keeps you on the page (useOpenRoom).
  useEffect(() => {
    useFeedStore.getState().setPage(material.id);
    return () => {
      const s = useFeedStore.getState();
      if (s.pageFor === material.id) s.setPage(null);
    };
  }, [material.id]);
  const inRoom = live.inRoomCount !== null;
  const openRoom = useOpenRoom();
  const toggleSave = useToggleMaterialBookmark();
  const { enter, pending: starting } = useEnterRoom();

  const ends = useMemo(() => chapterEnds(material.sections, material.spine), [material.sections, material.spine]);
  // positionPercent: a full bar means the reader marked it finished
  // (lib/reader/locator.ts).
  const progress: BookProgress = position ? { pct: positionPercent(position), finished: !!position.finishedAt, listening: position.mode === "listen" } : null;
  const header = useMemo(
    () =>
      bookHeader(
        {
          title: material.title,
          materialType: material.materialType,
          author: material.author,
          // The header shows it at 80 px at most: the small image.
          cover: resolveBookThumbnailSrc(material),
          // Google first, OpenLibrary as backup; the first-party field isn't
          // reliably filled (as the old details page had it).
          description: material.googleDescription ?? material.openlibraryDescription ?? material.description ?? "",
          publishedYear: material.publishedYear,
          pageCountEstimate: material.pageCountEstimate,
          narratorCount: material.narratorCount,
          noteCount: material.noteCount,
          readers: material.currentReaders,
          readerCount: material.currentReaderCount,
        },
        position ? { pct: positionPercent(position), finished: !!position.finishedAt, listening: position.mode === "listen" } : null,
        ends
      ),
    [material, position, ends]
  );
  const items = useMemo((): RoomItem[] => {
    const all = roomItems(stream.data?.pages ?? [], {
      tz,
      viewerId,
      cards: card ? [{ ref: card.session.id, item: { t: "session", card } }] : [],
      pending: send.items,
    });
    return all.length ? all : [{ t: "empty" }];
  }, [stream.data, card, send.items, tz, viewerId]);

  // One resume action in the mode last used; Listen switches mode.
  const resume = (mode: "read" | "listen") =>
    router.push(readerHref(position ? buildResumeHref(material.slug, { ...position, mode }) : `/read/${material.slug}${mode === "listen" ? "?listen=1" : ""}`));
  const isOwnUpload = !!material.contributor && material.contributor.readerId === viewerId;
  const onSwitch = () => resume(progress?.listening ? "read" : "listen");
  const onContinue = () => resume(progress?.listening ? "listen" : "read");

  const menu: OverflowMenuItem[] = [
    ...(canStart && !liveRoom && !inRoom
      ? [{ label: "Start room", icon: <Mic size={14} />, disabled: starting, onClick: () => void enter({ materialId: material.id, start: { bookTitle: material.title } }) }]
      : []),
    ...(isOwnUpload
      ? []
      : [{ label: isSaved ? "Saved" : "Save for later", icon: <Bookmark size={14} />, onClick: () => toggleSave.mutate(material.id) }]),
  ];

  return (
    <RoomScreen sidebar={false}>
      <BookRoom
        header={header}
        onBack={() => (window.history.length > 1 ? router.back() : router.push("/library"))}
        menu={menu}
        resume={(onClose) => <ReadingBar header={header} audiobook={material.narratorCount > 0} ready={positionReady} onContinue={onContinue} onSwitch={onSwitch} onClose={onClose} />}
        infoOpen={infoOpen}
        onInfo={() => showInfo(true)}
        onCloseInfo={() => showInfo(false)}
        info={
          <BookDetails
            material={material}
            header={header}
            ready={positionReady}
            onContinue={onContinue}
            onSwitch={onSwitch}
            onChapter={(id) => router.push(readerHref(`/read/${material.slug}?section=${id}`))}
          />
        }
        items={items}
        viewerId={viewerId}
        today={today}
        loading={stream.isLoading}
        states={send.states}
        hasOlder={stream.hasNextPage}
        onLoadOlder={() => !stream.isFetchingNextPage && void stream.fetchNextPage()}
        onReadToBottom={markRead}
        live={
          inRoom || card?.state === "live"
            ? {
                card,
                // In it already: Join reopens its panel.
                onJoin: inRoom ? () => openRoom(material.id) : liveRoom ? () => void live.join(liveRoom.id, liveRoom.title) : undefined,
              }
            : null
        }
        handlers={{
          onReact: (n, replyId) => viewerId && heart.mutate({ noteId: replyId ?? n.note.id, rootId: n.note.id }),
          onReply: viewerId ? (n, r, to) => void reply(n.note.id, r, to, n.note.ranges) : undefined,
          onDelete: viewerId ? (n, replyId) => del.mutate({ noteId: replyId ?? n.note.id, rootId: n.note.id }) : undefined,
          onRetry: (n) => send.retry(n.note.id),
          onPassage: openPassage,
          onHighlightVisibility: (id, visibility) => highlightVisibility.mutate({ id, visibility }),
          onHighlightDelete: (id) => highlightDelete.mutate(id),
        }}
        input={
          viewerId ? (
            <RoomInput placeholder={`Note on ${material.title}`} canLock onSend={send.send} />
          ) : (
            <button type="button" onClick={() => router.push("/auth/login")} className="mx-auto flex min-h-12 cursor-pointer items-center justify-center px-4 text-ui-sm font-extrabold text-[var(--color-app-brand)] hover:text-brand-600 disabled:opacity-60">
              Join the conversation
            </button>
          )
        }
      />
    </RoomScreen>
  );
}

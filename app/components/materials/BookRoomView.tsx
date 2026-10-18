"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Bookmark, Mic } from "lucide-react";
import type { OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";
import { ModeIcon } from "@/app/components/rooms/RoomHeader";
import { useEnterRoom } from "@/lib/room/useEnterRoom";
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
import { button } from "@/app/components/rooms/buttons";
import { useBookRoom } from "@/lib/rooms/useBookRoom";
import { useFeedStore } from "@/stores/feed-store";
import { useReadingPositionStore } from "@/stores/reading-position-store";

// Loaded only while you're in the book's live room.
const RoomStage = dynamic(() => import("@/app/components/room/RoomPanel").then((m) => m.RoomStage), { ssr: false });
const RoomChatComposer = dynamic(() => import("@/app/components/room/RoomChat").then((m) => m.RoomChatComposer), { ssr: false });

/**
 * A book's page (rooms-spec §2 Book room, 6a–6c): Room, Live and Info tabs,
 * opening on Info unless `?tab=room` asks for the Room (Home's conversations). Server-rendered from the book's facts; the viewer's
 * progress, the stream and the live room load on the client. A live
 * reading room is the Live tab: Join there (or on its card) and the room
 * opens in place, as the mini-player's expand does here, rather than going
 * to the reader.
 */
export default function BookRoomView({ material, initialTab }: { material: MaterialDetail; initialTab: "details" | "room" }) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  // Gates progress and the resume button on the server's position (see the hook).
  const positionReady = useServerPositionReady();
  // A quote opens the reader over the room (the `@modal` overlay).
  const openPassage = (n: RoomNote) => {
    const href = quoteReaderHref(n);
    if (href) router.push(href);
  };
  const { viewerId, stream, send, heart, reply, del, markRead, live, liveRoom, canStart, card, tz, today } = useBookRoom(material.id);
  const position = useReadingPositionStore((s) => s.positions[material.id]);
  const isSaved = useBookmarkedMaterialIds().has(material.id);

  // The Live tab is the feed store's Room tab for this book, so the
  // mini-player can open it; the page holds it only while it's showing.
  const liveOpen = useFeedStore((s) => s.openFor === material.id && s.tab === "room");
  const setLiveOpen = (open: boolean) => (open ? useFeedStore.getState().open(material.id, "room") : useFeedStore.getState().close());
  useEffect(() => {
    const feed = useFeedStore.getState();
    feed.setPage(material.id);
    return () => {
      const s = useFeedStore.getState();
      if (s.pageFor === material.id) s.setPage(null);
      if (s.openFor === material.id) s.close();
    };
  }, [material.id]);
  // Just joined (here, on its card or the tab): straight to the room.
  const inRoom = live.inRoomCount !== null;
  const wasInRoom = useRef(inRoom);
  useEffect(() => {
    if (inRoom && !wasInRoom.current) useFeedStore.getState().open(material.id, "room");
    wasInRoom.current = inRoom;
  }, [inRoom, material.id]);
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
        ends,
        viewerId
      ),
    [material, position, ends, viewerId]
  );
  const items = useMemo((): RoomItem[] => {
    const all = roomItems(stream.data?.pages ?? [], {
      tz,
      viewerId,
      cards: card ? [{ ref: card.session.id, item: { t: "session", card } }] : [],
      pending: send.items,
      reading: header.readers.length ? { today, item: { t: "reading", count: header.readingNow, readers: header.readers } } : null,
    });
    return all.length ? all : [{ t: "empty" }];
  }, [stream.data, card, send.items, tz, viewerId, today, header]);

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
    { label: header.cta, icon: <ModeIcon listening={header.listening} size={14} />, disabled: !positionReady, onClick: onContinue },
  ];

  return (
    <RoomScreen sidebar={false}>
      <BookRoom
        header={header}
        tab={liveOpen ? "live" : tab}
        onTab={(next) => {
          setLiveOpen(next === "live");
          if (next === "live") return;
          setTab(next);
          replaceTabParam(next);
        }}
        onBack={() => (window.history.length > 1 ? router.back() : router.push("/library"))}
        menu={menu}
        details={
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
                joined: inRoom ? { stage: <RoomStage />, composer: <RoomChatComposer materialId={material.id} /> } : null,
                onJoin: liveRoom ? () => void live.join(liveRoom.id) : undefined,
              }
            : null
        }
        handlers={{
          onReact: (n, replyId) => viewerId && heart.mutate({ noteId: replyId ?? n.note.id, rootId: n.note.id }),
          onReply: viewerId ? (n, r, to) => void reply(n.note.id, r, to, n.note.ranges) : undefined,
          onDelete: viewerId ? (n, replyId) => del.mutate({ noteId: replyId ?? n.note.id, rootId: n.note.id }) : undefined,
          onRetry: (n) => send.retry(n.note.id),
          onPassage: openPassage,
        }}
        input={
          viewerId ? (
            <RoomInput placeholder={`Note on ${material.title}`} onSend={send.send} />
          ) : (
            <button type="button" onClick={() => router.push("/auth/signup")} className={button("primary", { full: true })}>
              Join the conversation
            </button>
          )
        }
      />
    </RoomScreen>
  );
}

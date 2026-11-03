"use client";

import { useRouter } from "next/navigation";
import { Mic, Share } from "lucide-react";
import type { OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";
import { readerHref } from "@/app/components/ReaderLink";
import HeadMenu from "@/app/components/rooms/HeadMenu";
import RoomScreen, { ScreenHead } from "@/app/components/rooms/RoomScreen";
import BookmarkButton from "@/app/components/shared/BookmarkButton";
import { useBookmarkedMaterialIds, useToggleMaterialBookmark } from "@/lib/bookmarks/useBookmarks";
import type { MaterialDetail } from "@/lib/materials/detail";
import { useResume } from "@/lib/reader/useResume";
import { useEnterRoom } from "@/lib/room/useEnterRoom";
import { useMaterialRoom } from "@/lib/room/useMaterialRoom";
import { useOpenRoom } from "@/lib/room/useOpenRoom";
import { useSessionStore } from "@/stores/session-store";
import { showToast } from "@/stores/toast-store";
import BookDetails, { useBookHeader } from "./BookDetails";
import { shareLink } from "./ShareButton";
import { PLATFORM_NAME } from "@/lib/config/platform";

/** Bookmark and the ⋮ (join or start its live reading room — either opens
 * the reader — and share), for the book page's head and the book panel's. */
export function BookActions({ material }: { material: MaterialDetail }) {
  const viewerId = useSessionStore((s) => s.readerId);
  const { data: room } = useMaterialRoom(material.id);
  const { enter, pending } = useEnterRoom();
  const openRoom = useOpenRoom();
  const isSaved = useBookmarkedMaterialIds().has(material.id);
  const toggleSave = useToggleMaterialBookmark();
  const isOwnUpload = !!material.contributor && material.contributor.readerId === viewerId;
  const live = room?.live ?? null;

  const go = async (entry: Parameters<typeof enter>[0]) => {
    if (await enter(entry)) openRoom(material.id);
  };
  const menu: OverflowMenuItem[] = [
    ...(live
      ? [{ label: "Join live room", icon: <Mic size={14} />, disabled: pending, onClick: () => void go({ materialId: material.id, join: { id: live.id, title: live.title } }) }]
      : viewerId && room?.canStart
        ? [{ label: "Start room", icon: <Mic size={14} />, disabled: pending, onClick: () => void go({ materialId: material.id, start: { bookTitle: material.title } }) }]
        : []),
    { label: "Share", icon: <Share size={14} />, onClick: () => void shareLink(material.title, `I think you’d like ${material.title} by ${material.author}. Read it on ${PLATFORM_NAME}.`).then((copied) => copied && showToast("Link copied")) },
  ];

  return (
    <div className="flex items-center gap-2">
      {!isOwnUpload && <BookmarkButton saved={isSaved} onToggle={() => toggleSave.mutate(material.id)} />}
      <HeadMenu items={menu} />
    </div>
  );
}

/** Book info: the book, your progress and the way back in, who's reading it
 * and its contents. */
export function BookBody({ material, outer = false }: { material: MaterialDetail; outer?: boolean }) {
  const router = useRouter();
  const header = useBookHeader(material);
  const { ready, onContinue, onSwitch } = useResume(material);
  return (
    <BookDetails
      material={material}
      header={header}
      ready={ready}
      onContinue={onContinue}
      onSwitch={onSwitch}
      onChapter={(id) => router.push(readerHref(`/read/${material.slug}?section=${id}`))}
      outer={outer}
    />
  );
}

/**
 * A book's page while book rooms are hidden (lib/config/features), for a
 * shared or typed link: in the app a book opens in BookPanel instead.
 */
export default function BookPage({ material }: { material: MaterialDetail }) {
  const router = useRouter();
  return (
    <RoomScreen scroll contain={false}>
      <ScreenHead onBack={() => (window.history.length > 1 ? router.back() : router.push("/library"))} action={<BookActions material={material} />} actionLast />
      <BookBody material={material} outer />
    </RoomScreen>
  );
}

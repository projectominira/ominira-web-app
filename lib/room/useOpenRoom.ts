"use client";

import { useRouter } from "next/navigation";
import { useFeedStore } from "@/stores/feed-store";
import { useRoomStore } from "@/stores/room-store";
import { useReaderView } from "./hooks";

/** Expands the room: the book's feed panel on its Room tab, or on the
 * book's details page its Live tab. Away from the book (the room outlives
 * the reader), it goes back to the book first, where the panel opens as the
 * reader loads. */
export function useOpenRoom() {
  const router = useRouter();
  const inReader = useReaderView() !== null;
  return (materialId: string) => {
    const feed = useFeedStore.getState();
    feed.open(materialId, "room");
    if (inReader || feed.pageFor === materialId) return;
    const room = useRoomStore.getState().snapshot?.room;
    router.push(`/reader/${room?.materialId === materialId ? room.bookSlug : materialId}`);
  };
}

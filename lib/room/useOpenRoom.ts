"use client";

import { useRouter } from "next/navigation";
import { useFeedStore } from "@/stores/feed-store";
import { openRoomPlayer } from "@/stores/layout-store";
import { useRoomStore } from "@/stores/room-store";
import { useReaderView } from "./hooks";

/** Expands the room's panel (RoomMiniPlayer). Away from the book and its
 * details page (the room outlives the reader), it goes back to the book
 * too, so you read along where the room is. */
export function useOpenRoom() {
  const router = useRouter();
  const inReader = useReaderView() !== null;
  return (materialId: string) => {
    openRoomPlayer();
    if (inReader || useFeedStore.getState().pageFor === materialId) return;
    const room = useRoomStore.getState().snapshot?.room;
    router.push(`/reader/${room?.materialId === materialId ? room.bookSlug : materialId}`);
  };
}

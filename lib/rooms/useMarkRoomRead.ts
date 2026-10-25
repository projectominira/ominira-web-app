import { useCallback, useEffect, useRef } from "react";
import { markRoomRead } from "./api";
import type { RoomKind } from "./types";

/** How long the stream stays at the bottom before it counts as read. */
const SETTLE_MS = 1500;

/** RoomStream's `onReadToBottom`, debounced into one room_reads upsert
 * (rooms-spec §5.2). Null `roomId` (signed out, not loaded) does nothing. */
export function useMarkRoomRead(kind: RoomKind, roomId: string | null): () => void {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), [kind, roomId]);
  return useCallback(() => {
    if (!roomId) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void markRoomRead(kind, roomId).catch(() => {}), SETTLE_MS);
  }, [kind, roomId]);
}

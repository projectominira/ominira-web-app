"use client";

import { useMemo, useState } from "react";
import { materialKeys } from "@/lib/materials/queryKeys";
import { useDeleteHighlight, useSetHighlightVisibility } from "@/lib/materials/useHighlightMutations";
import { useJoinLive } from "@/lib/room/useJoinLive";
import { useMaterialRoom } from "@/lib/room/useMaterialRoom";
import { liveCard } from "./cards";
import { useBookStream, useRoomDelete, useRoomHeart, useRoomReply, useRoomSend } from "./hooks";
import { useMarkRoomRead } from "./useMarkRoomRead";
import { useNow } from "@/lib/time/useNow";
import { deviceTimeZone, localDay } from "@/lib/time/zone";
import { useSessionStore } from "@/stores/session-store";

/**
 * The book room's data and actions, one source for the book's details page
 * (BookRoomView) and the reader's right panel (BookRoomPanel): the stream,
 * sending, hearts, replies, deleting, a highlight made public or private or deleted, read marks, the live session and the open
 * thread. Each renders it in its own frame.
 */
export function useBookRoom(materialId: string, initialThreadId: string | null = null) {
  const viewerId = useSessionStore((s) => s.readerId);
  const stream = useBookStream(materialId);
  const streamKey = materialKeys.stream(materialId, viewerId);
  const send = useRoomSend(streamKey, { materialId });
  const heart = useRoomHeart(streamKey);
  const reply = useRoomReply(streamKey);
  const del = useRoomDelete(streamKey);
  const highlightVisibility = useSetHighlightVisibility(materialId);
  const highlightDelete = useDeleteHighlight(materialId);
  const markRead = useMarkRoomRead("book", viewerId ? materialId : null);
  const { data: room } = useMaterialRoom(materialId);
  const live = useJoinLive(materialId);
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const now = useNow();
  const tz = deviceTimeZone();
  const today = localDay(now, tz);
  const liveRoom = room?.live ?? null;
  const card = useMemo(() => liveRoom && liveCard(liveRoom, now), [liveRoom, now]);
  const canStart = !!viewerId && !!room?.canStart;
  return { viewerId, stream, send, heart, reply, del, highlightVisibility, highlightDelete, markRead, live, liveRoom, canStart, card, threadId, setThreadId, now, tz, today };
}

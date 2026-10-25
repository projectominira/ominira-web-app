"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { groupKeys } from "@/lib/groups/queryKeys";
import type { GroupLiveRoom } from "@/lib/groups/types";
import { useOpenRoom } from "@/lib/room/useOpenRoom";
import { activeRoom, useRoomStore } from "@/stores/room-store";
import { showToast } from "@/stores/toast-store";

/**
 * Into the group's room from the group page (studygroup-spec §11): start it
 * (M11, moderators) or join the live one, then open it on its book. The
 * group's queries refresh after, so the slot shows the room live.
 */
export function useGroupRoom(slug: string) {
  const start = useRoomStore((s) => s.start);
  const join = useRoomStore((s) => s.join);
  const inRoomId = useRoomStore((s) => activeRoom(s)?.room.id ?? null);
  const open = useOpenRoom();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const enter = async (go: () => Promise<void>, materialId: string): Promise<boolean> => {
    setPending(true);
    try {
      await go();
      open(materialId);
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't open the room.");
      return false;
    } finally {
      setPending(false);
      void queryClient.invalidateQueries({ queryKey: [...groupKeys.all, slug] });
    }
  };

  return {
    pending,
    /** The room you're in, if it's this one. */
    isIn: (room: GroupLiveRoom) => room.id === inRoomId,
    start: (materialId: string, title: string | null, sessionId: string | null) =>
      enter(() => start(materialId, title ?? undefined, { groupSlug: slug, sessionId }), materialId),
    /** Joins the live room (or, already in, just opens it). */
    join: (room: GroupLiveRoom) => enter(() => join(room.id), room.materialId),
  };
}

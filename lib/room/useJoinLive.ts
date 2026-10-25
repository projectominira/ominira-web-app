"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useIsAuthenticated } from "@/lib/auth/useIsAuthenticated";
import { materialKeys } from "@/lib/materials/queryKeys";
import { useOpenRoom } from "@/lib/room/useOpenRoom";
import { askToJoin } from "@/stores/join-store";
import { activeRoom, useRoomStore } from "@/stores/room-store";
import { showToast } from "@/stores/toast-store";

/** Into a book's live room (spec §3.1, §11): join it after its join
 * screen, staying where you are with its panel open, or open it when
 * you're already in.
 * `inRoomCount` is the room's roster while you're in it, else null. */
export function useJoinLive(materialId: string) {
  const signedIn = useIsAuthenticated();
  const inRoomCount = useRoomStore((s) => {
    const room = activeRoom(s);
    return room?.room.materialId === materialId ? room.roster.length : null;
  });
  const join = useRoomStore((s) => s.join);
  const openRoom = useOpenRoom();
  const queryClient = useQueryClient();
  return {
    inRoomCount,
    async join(roomId: string, title: string) {
      if (inRoomCount !== null) return openRoom(materialId);
      if (!signedIn) return showToast("Sign in to join the room.");
      if (!(await askToJoin({ id: roomId, title }))) return;
      try {
        await join(roomId);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Couldn't join the room.");
        void queryClient.invalidateQueries({ queryKey: materialKeys.room(materialId) });
      }
    },
  };
}

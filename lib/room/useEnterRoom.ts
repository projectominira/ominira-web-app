"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useIsAuthenticated } from "@/lib/auth/useIsAuthenticated";
import { materialKeys } from "@/lib/materials/queryKeys";
import { useRoomStore } from "@/stores/room-store";
import { confirmAction } from "@/stores/confirm-store";
import { askToJoin } from "@/stores/join-store";
import { showToast } from "@/stores/toast-store";

/** Into a book's room: join the one live on it, or start one (interim
 * host: any signed-in reader, public books only). */
export type RoomEntry = { materialId: string } & (
  | { join: { id: string; title: string } }
  /** `readers`: comrades who read it today, told when it starts. */
  | { start: { bookTitle?: string; readers?: number } }
);

/** Asks first (the join screen, or for a start a confirm; unless `confirm`
 * is false: the tap was already "Join"), then joins or starts the room; true once you're in. Signed out, or on a
 * refusal, it says why in a toast. `pending` while it goes. */
export function useEnterRoom() {
  const signedIn = useIsAuthenticated();
  const start = useRoomStore((s) => s.start);
  const join = useRoomStore((s) => s.join);
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const enter = async (entry: RoomEntry, { confirm = true }: { confirm?: boolean } = {}): Promise<boolean> => {
    if (!signedIn) {
      showToast("Sign in to join the room.");
      return false;
    }
    const readers = "start" in entry ? (entry.start.readers ?? 0) : 0;
    const ok =
      !confirm ||
      (await ("join" in entry
        ? askToJoin(entry.join)
        : confirmAction({
            title: "Start a reading room?",
            message:
              `Anyone reading ${entry.start.bookTitle ?? "this book"} can join and listen in.` +
              (readers > 0 ? ` We’ll let the ${readers === 1 ? "comrade" : `${readers} comrades`} who read it today know.` : ""),
            confirmLabel: "Start room",
          })));
    if (!ok) return false;
    setPending(true);
    try {
      if ("join" in entry) await join(entry.join.id);
      else await start(entry.materialId);
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't open the room.");
      return false;
    } finally {
      setPending(false);
      void queryClient.invalidateQueries({ queryKey: materialKeys.room(entry.materialId) });
    }
  };

  return { enter, pending };
}

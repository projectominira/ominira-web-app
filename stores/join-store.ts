import { create } from "zustand";

type Pending = { room: { id: string; title: string }; resolve: (ok: boolean) => void };

/** One join screen at a time, rendered by app/components/room/JoinRoomDialog.tsx.
 * A newer ask cancels the one still open. */
export const useJoinStore = create<{ pending: Pending | null; settle: (ok: boolean) => void }>((set, get) => ({
  pending: null,
  settle: (ok) => {
    get().pending?.resolve(ok);
    set({ pending: null });
  },
}));

/** The room's join screen (who's in, then Start listening): true on Start
 * listening, false on close / Escape / backdrop. */
export function askToJoin(room: { id: string; title: string }): Promise<boolean> {
  useJoinStore.getState().pending?.resolve(false);
  return new Promise((resolve) => useJoinStore.setState({ pending: { room, resolve } }));
}

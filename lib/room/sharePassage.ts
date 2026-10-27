"use client";

import type { AnnotationRange } from "@/lib/api/types";
import { useCreateNote } from "@/lib/community/useNoteMutations";
import { roomChatUnread, useRoomStore } from "@/stores/room-store";
import { showToast } from "@/stores/toast-store";

// Share passage (spec §1.4, §3.2): from the reader's selection menu, the
// passage goes to the room chat's composer; sending it saves a normal public
// note on the passage, through the notes' own create path (useCreateNote),
// then posts it to the chat, which shows that note (NoteBubble). Nothing about
// the note is room-specific, except that a group room's note is posted to
// the group (`group_id`), so it shows on the group's Notes tab.

/** A selection waiting in the chat composer. */
export type PendingPassage = { ranges: AnnotationRange[]; quote: string; label: string };

/** The selection menu's Share to room: null unless you're in the room on this book. */
export function useShareToRoom(materialId: string): ((passage: PendingPassage) => void) | null {
  const inRoom = useRoomStore((s) => roomChatUnread(s, materialId) !== null);
  const attach = useRoomStore((s) => s.attachPassage);
  return inRoom ? attach : null;
}

/** Sends a shared passage with your words: in your chat at once, posted to
 * the room once its note saves (the chat shows that note, NoteBubble), and
 * taken out with a toast if it doesn't. `wait` within 2 s of your last
 * message. */
export function useSendPassage(materialId: string) {
  const createNote = useCreateNote(materialId);
  return (passage: PendingPassage, text: string): "sent" | "wait" => {
    const session = useRoomStore.getState().session;
    const id = session?.shareChat(text, { quote: passage.quote, label: passage.label });
    if (!session || !id) return "wait";
    // In a group room, the note is the group's too (studygroup-spec §11).
    const groupSlug = useRoomStore.getState().snapshot?.room.group?.slug;
    createNote
      .mutateAsync({
        ranges: passage.ranges,
        content: { kind: "text", text: text.trim() },
        visibility: "public",
        ...(groupSlug && { groupSlug }),
      })
      .then(
        (note) => session.sharedChat(id, note.id),
        () => {
          session.unshareChat(id);
          showToast("Couldn’t share the passage. Check your connection and try again.");
        },
      );
    return "sent";
  };
}

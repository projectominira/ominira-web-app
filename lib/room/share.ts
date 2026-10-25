"use client";

import { showToast } from "@/stores/toast-store";

// Inviting comrades into a room: its link (/room/{id}), through the
// device's share sheet where there is one, else copied.

export const roomLink = (roomId: string) => `${window.location.origin}/room/${roomId}`;

export async function copyRoomLink(roomId: string) {
  try {
    await navigator.clipboard.writeText(roomLink(roomId));
    showToast("Link copied.");
  } catch {
    showToast("Couldn't copy the link.");
  }
}

/** The share sheet with the room's link; copies it where there's no sheet. */
export async function shareRoom(room: { id: string; bookTitle: string }) {
  if (!navigator.share) return copyRoomLink(room.id);
  try {
    await navigator.share({ title: `${room.bookTitle} reading room`, text: `Read ${room.bookTitle} with me on Ominira.`, url: roomLink(room.id) });
  } catch (err) {
    // Closing the sheet isn't a failure.
    if (!(err instanceof DOMException && err.name === "AbortError")) await copyRoomLink(room.id);
  }
}

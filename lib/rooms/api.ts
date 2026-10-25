import { apiFetch } from "@/lib/api/client";
import type { RoomKind, RoomStreamPage } from "@/lib/rooms/types";
import type { NoteGroup } from "@/lib/rooms/routing";

// Client side of the room routes (rooms-spec §5).

const page = (path: string, cursor: string | null) =>
  apiFetch<RoomStreamPage>(cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path);

export const getGroupStream = (slug: string, cursor: string | null) => page(`/groups/${slug}/stream`, cursor);

export const getBookStream = (materialId: string, cursor: string | null) => page(`/materials/${materialId}/stream`, cursor);

export const markRoomRead = (kind: RoomKind, roomId: string) =>
  apiFetch<void>("/auth/me/room-reads", { method: "POST", json: { kind, roomId } });

/** The reader's book room head: the book as its page heads it, and where
 * your notes also go. */
export type ReaderRoomHead = { title: string; author: string; slug: string; cover: string | null; group: NoteGroup | null };

export const getReaderRoomHead = (materialId: string) => apiFetch<ReaderRoomHead>(`/materials/${materialId}/reader-room`);

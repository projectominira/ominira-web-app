import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import type { RoomKind } from "./types";

// room_reads (rooms-spec §5.2, migrations/20261105_room_reads.sql): how far
// each reader has read each room. The maths on it is lib/rooms/unread.

/** Read to the bottom, now. The client debounces it. */
export async function markRoomRead(readerId: string, kind: RoomKind, roomId: string): Promise<void> {
  const { error } = await getSupabaseAdminClient()
    .from("room_reads")
    .upsert({ reader_id: readerId, room_kind: kind, room_id: roomId, last_read_at: new Date().toISOString() });
  if (error) throw error;
}

/** When the reader last read the room to the bottom. Every member belongs
 * to every book room, so one never opened counts from when they joined
 * Ominira (a group's, from when they joined the group); null signed out, or
 * not in the group. */
export async function lastReadAt(readerId: string | null | undefined, kind: RoomKind, roomId: string): Promise<string | null> {
  if (!readerId) return null;
  const admin = getSupabaseAdminClient();
  const [read, joined] = await Promise.all([
    admin.from("room_reads").select("last_read_at").eq("reader_id", readerId).eq("room_kind", kind).eq("room_id", roomId).maybeSingle(),
    kind === "book"
      ? admin.from("readers").select("joined_at").eq("id", readerId).maybeSingle()
      : admin.from("group_members").select("joined_at").eq("group_id", roomId).eq("reader_id", readerId).maybeSingle(),
  ]);
  if (read.error) throw read.error;
  if (joined.error) throw joined.error;
  return read.data?.last_read_at ?? joined.data?.joined_at ?? null;
}

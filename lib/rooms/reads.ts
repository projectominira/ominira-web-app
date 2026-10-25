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

/** When the reader last read the room to the bottom; null if never. */
export async function lastReadAt(readerId: string | null | undefined, kind: RoomKind, roomId: string): Promise<string | null> {
  if (!readerId) return null;
  const { data, error } = await getSupabaseAdminClient()
    .from("room_reads")
    .select("last_read_at")
    .eq("reader_id", readerId)
    .eq("room_kind", kind)
    .eq("room_id", roomId)
    .maybeSingle();
  if (error) throw error;
  return data?.last_read_at ?? null;
}

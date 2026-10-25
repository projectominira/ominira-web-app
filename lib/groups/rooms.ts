import "server-only";

import { after } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { notifyReaders } from "@/lib/notifications/notify";
import { groupHref } from "@/lib/groups/copy";
import type { Group } from "@/lib/groups/membership";
import { roomTitle } from "@/lib/room/title";
import type { GroupLiveRoom } from "@/lib/groups/types";
import { comradesById } from "@/lib/rooms/comrades";
import type { Database } from "@/lib/supabase/database.types";

/** Faces on the live card. */
const LIVE_FACES = 4;

// The group side of its Reading Rooms (studygroup-spec.md §11): telling the
// members, and the live room on the group page. The ended screen's next
// session is schedule.ts's nextSessionForRoom. Who may start, join and
// moderate is SQL's (start_room, can_join_room, room_moderator_ids,
// migrations/20261027_group_rooms.sql).

/** `room_live` (§7) to every member but the starter, after the response.
 * Once per room (deduped on its id). */
export function notifyRoomLive(group: Pick<Group, "id" | "slug" | "name">, starterId: string, roomId: string, title: string) {
  after(async () => {
    try {
      const { data: members } = await getSupabaseAdminClient()
        .from("group_members")
        .select("reader_id")
        .eq("group_id", group.id)
        .neq("reader_id", starterId);
      if (!members?.length) return;
      await notifyReaders(
        members.map((m) => m.reader_id),
        {
          kind: "room_live",
          groupId: group.id,
          title: `The room is open · ${group.name}`,
          body: title,
          url: groupHref(group.slug),
          tag: `group-room-${group.id}`,
          actorReaderId: starterId,
          ref: roomId,
        }
      );
    } catch (err) {
      console.error("Failed to send room_live", err);
    }
  });
}

/** The group's live room, if any, with who started it and how many are in. */
export async function groupLiveRoom(groupId: string): Promise<GroupLiveRoom | null> {
  const admin = getSupabaseAdminClient();
  const { data: room, error } = await admin
    .from("rooms")
    .select("id, material_id, title, session_id, started_by, started_at")
    .eq("group_id", groupId)
    .eq("status", "live")
    .maybeSingle();
  if (error) throw error;
  if (!room) return null;
  const book = await admin.from("materials").select("title").eq("id", room.material_id).single();
  if (book.error) throw book.error;
  return liveRoom(room, book.data.title);
}

type LiveRow = Pick<Database["public"]["Tables"]["rooms"]["Row"], "id" | "material_id" | "title" | "session_id" | "started_by" | "started_at">;

/** A live room as its card shows it (a group's, or a book's standalone
 * one): who started it, how many are in, and a few of their faces. */
export async function liveRoom(room: LiveRow, bookTitle: string): Promise<GroupLiveRoom> {
  const admin = getSupabaseAdminClient();
  const [members, inRoom] = await Promise.all([
    admin.rpc("room_active_count", { room: room.id }),
    admin.from("room_members").select("reader_id").eq("room_id", room.id).is("left_at", null).order("joined_at").limit(LIVE_FACES),
  ]);
  if (members.error) throw members.error;
  if (inRoom.error) throw inRoom.error;
  const faces = inRoom.data.map((m) => m.reader_id);
  const comrades = await comradesById([room.started_by, ...faces]);
  return {
    id: room.id,
    materialId: room.material_id,
    title: roomTitle(room.title, bookTitle),
    sessionId: room.session_id,
    starterName: comrades.get(room.started_by)?.pseudonym ?? "",
    starterId: room.started_by,
    startedAt: room.started_at,
    members: members.data,
    people: faces.flatMap((id) => comrades.get(id) ?? []),
  };
}

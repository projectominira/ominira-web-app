import "server-only";

import { after } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { resolveBookCoverSrc } from "@/lib/materials/image";
import { MATERIAL_SUMMARY_COLUMNS } from "@/lib/materials/columns";
import { toMaterialSummary } from "@/lib/materials/summary";
import { existingReaders } from "@/lib/community/mentions";
import { notifyReaders } from "@/lib/notifications/notify";
import { comradeName } from "@/lib/reader/authorDisplay";
import { roomTitle } from "@/lib/room/title";
import type { RoomInfo, RoomInvite } from "@/lib/room/types";

// A room's invites: the push to comrades who read its book today when it
// starts, and what its link (/room/{id}) shows before you join.

/** Who's invited when a room starts: readers of the book in the last day. */
const INVITE_WINDOW_MS = 24 * 60 * 60_000;

/** The book's live room, if any: a start then joins it rather than starting. */
export async function liveRoomOn(materialId: string): Promise<string | null> {
  const { data, error } = await getSupabaseAdminClient().from("rooms").select("id").eq("material_id", materialId).eq("status", "live").limit(1).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/** `room_live` to everyone but the starter who read the book in the last
 * day, after the response. One a day per book and reader, so a room
 * restarted on the same book doesn't push again. */
export function inviteReaders(room: Pick<RoomInfo, "id" | "materialId" | "bookTitle">, starterId: string) {
  after(async () => {
    try {
      const admin = getSupabaseAdminClient();
      const [readers, starter] = await Promise.all([
        admin
          .from("reader_activities")
          .select("reader_id")
          .eq("material_id", room.materialId)
          .neq("reader_id", starterId)
          .gt("updated_at", new Date(Date.now() - INVITE_WINDOW_MS).toISOString()),
        admin.from("readers").select("pseudonym").eq("id", starterId).single(),
      ]);
      if (readers.error) throw readers.error;
      if (starter.error) throw starter.error;
      if (!readers.data.length) return;
      await notifyReaders(
        readers.data.map((r) => r.reader_id),
        {
          kind: "room_live",
          title: `${room.bookTitle} is live`,
          body: `${comradeName(starter.data.pseudonym)} started a reading room. Join in.`,
          url: `/room/${room.id}`,
          tag: `room-${room.id}`,
          actorReaderId: starterId,
          // The in-app row names the book after "started a reading room on".
          snippet: room.bookTitle,
          // room_live dedupes (lib/notifications/policy): one a day per book.
          ref: `book:${room.materialId}`,
        },
      );
    } catch (err) {
      console.error("Failed to send room_live", err);
    }
  });
}

/** What a room's link shows: the room, its book, who started it and how
 * many are in. Null for no such room (or a group's, which isn't public). */
export async function roomInvite(roomId: string): Promise<RoomInvite | null> {
  const admin = getSupabaseAdminClient();
  const { data: room, error } = await admin.from("rooms").select("id, material_id, title, status, started_by, group_id").eq("id", roomId).maybeSingle();
  if (error) throw error;
  if (!room || room.group_id) return null;
  const [material, host, members] = await Promise.all([
    admin.from("materials").select(MATERIAL_SUMMARY_COLUMNS).eq("id", room.material_id).eq("status", "published").eq("visibility", "public").maybeSingle(),
    admin.from("readers").select("pseudonym").eq("id", room.started_by).maybeSingle(),
    room.status === "live" ? admin.rpc("room_active_count", { room: room.id }) : null,
  ]);
  if (material.error) throw material.error;
  if (host.error) throw host.error;
  if (members?.error) throw members.error;
  if (!material.data) return null;
  const book = toMaterialSummary(material.data);
  return {
    id: room.id,
    title: roomTitle(room.title, book.title),
    live: room.status === "live",
    members: members?.data ?? 0,
    host: host.data ? comradeName(host.data.pseudonym) : null,
    materialId: book.id,
    bookTitle: book.title,
    bookAuthor: book.author,
    bookSlug: book.slug,
    cover: resolveBookCoverSrc(book),
  };
}

/** A member's tagged invite to a live room: `room_live` to every tagged
 * reader, saying who invited them; it opens the room's link. One per room
 * and reader a day (policy dedupe). */
export async function inviteToRoom(roomId: string, actorId: string, readerIds: string[]): Promise<"ok" | "not_found" | "forbidden"> {
  const admin = getSupabaseAdminClient();
  const [room, member] = await Promise.all([
    admin.from("rooms").select("id, material_id, status, group_id").eq("id", roomId).maybeSingle(),
    admin.from("room_members").select("reader_id").eq("room_id", roomId).eq("reader_id", actorId).maybeSingle(),
  ]);
  if (room.error) throw room.error;
  if (member.error) throw member.error;
  if (!room.data || room.data.status !== "live" || room.data.group_id) return "not_found";
  if (!member.data) return "forbidden";

  const tagged = await existingReaders(readerIds, actorId);
  if (tagged.length === 0) return "ok";
  const [book, actor] = await Promise.all([
    admin.from("materials").select("title").eq("id", room.data.material_id).single(),
    admin.from("readers").select("pseudonym").eq("id", actorId).maybeSingle(),
  ]);
  if (book.error) throw book.error;
  const who = actor.data?.pseudonym ? comradeName(actor.data.pseudonym) : "A comrade";
  await notifyReaders(tagged, {
    kind: "room_live",
    title: `${who} invited you to a reading room`,
    body: `${book.data.title} is live. Join in.`,
    url: `/room/${roomId}`,
    tag: `room-invite-${roomId}`,
    actorReaderId: actorId,
    snippet: book.data.title,
    ref: `invite:${roomId}`,
  });
  return "ok";
}

import type { Metadata } from "next";
import RoomsAdminView from "./RoomsAdminView";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { roomTitle } from "@/lib/room/title";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reading rooms admin",
  robots: { index: false, follow: false },
};

/** How many of the latest rooms the history shows. */
const LIMIT = 500;

export default async function AdminRoomsPage() {
  const admin = getSupabaseAdminClient();
  const { data: rooms, error } = await admin
    .from("rooms")
    .select("id, group_id, material_id, title, started_by, status, started_at, ended_at")
    .order("started_at", { ascending: false })
    .limit(LIMIT);
  if (error) throw new Error(`Could not load reading rooms: ${error.message}`);

  const list = rooms ?? [];
  const ids = (key: "group_id" | "material_id" | "started_by") => [...new Set(list.map((r) => r[key]).filter((id): id is string => !!id))];
  const [groupIds, bookIds, starterIds, roomIds] = [ids("group_id"), ids("material_id"), ids("started_by"), list.map((r) => r.id)];
  const [{ data: groups }, { data: books }, { data: starters }, { data: members }] = await Promise.all([
    groupIds.length ? admin.from("groups").select("id, name, slug").in("id", groupIds) : { data: [] },
    bookIds.length ? admin.from("materials").select("id, title").in("id", bookIds) : { data: [] },
    starterIds.length ? admin.from("readers").select("id, pseudonym").in("id", starterIds) : { data: [] },
    roomIds.length ? admin.from("room_members").select("room_id, reader_id").in("room_id", roomIds) : { data: [] },
  ]);

  const groupById = new Map((groups ?? []).map((g) => [g.id, g]));
  const titles = new Map((books ?? []).map((b) => [b.id, b.title]));
  const pseudonyms = new Map((starters ?? []).map((r) => [r.id, r.pseudonym]));
  const readers = new Map<string, Set<string>>();
  for (const { room_id, reader_id } of members ?? []) readers.set(room_id, (readers.get(room_id) ?? new Set()).add(reader_id));

  return (
    <RoomsAdminView
      limit={LIMIT}
      rooms={list.map((r) => {
        const book = titles.get(r.material_id) ?? "Untitled";
        const group = r.group_id ? groupById.get(r.group_id) : undefined;
        return {
          id: r.id,
          title: roomTitle(r.title, book),
          book,
          group: group ? { name: group.name, slug: group.slug } : null,
          startedBy: pseudonyms.get(r.started_by) ?? null,
          live: r.status === "live",
          startedAt: r.started_at,
          endedAt: r.ended_at,
          readers: readers.get(r.id)?.size ?? 0,
        };
      })}
    />
  );
}

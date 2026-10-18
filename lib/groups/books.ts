import "server-only";

import { after } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { MATERIAL_SUMMARY_COLUMNS } from "@/lib/materials/columns";
import { toMaterialSummary } from "@/lib/materials/summary";
import { notifyReaders } from "@/lib/notifications/notify";
import { localDay } from "@/lib/time/zone";
import { groupHref } from "@/lib/groups/copy";
import { postBookFinished } from "@/lib/groups/milestones";
import { isModerator, type GroupOutcome } from "@/lib/groups/membership";
import { sessionsPerBook } from "@/lib/groups/schedule";
import type { GroupBook, GroupBookStatus } from "@/lib/groups/types";
import type { NoteGroup } from "@/lib/rooms/routing";

// The reading list (spec §3.2 M9) for the thin app/api/groups/{slug}/books
// routes. One current book per group is held in SQL (add_group_book /
// set_current_group_book, migrations/20261023_group_books.sql); every write
// here is moderators only.

type Group = { id: string; slug: string; name: string; timezone: string };

const STATUS_ORDER: Record<GroupBookStatus, number> = { current: 0, next: 1, done: 2 };

/** Current, then Up next in the moderators' order (unplaced books after,
 * by start date, undated last, then by when added), then Done, latest
 * first. */
function compareBooks(
  a: { status: GroupBookStatus; position: number | null; starts_on: string | null; finished_on: string | null; created_at: string },
  b: typeof a
): number {
  if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (a.status === "done") return (b.finished_on ?? "").localeCompare(a.finished_on ?? "");
  if (a.position !== b.position) {
    if (a.position === null) return 1;
    if (b.position === null) return -1;
    return a.position - b.position;
  }
  if (a.starts_on !== b.starts_on) {
    if (!a.starts_on) return 1;
    if (!b.starts_on) return -1;
    return a.starts_on.localeCompare(b.starts_on);
  }
  return a.created_at.localeCompare(b.created_at);
}

export async function listGroupBooks(groupId: string): Promise<GroupBook[]> {
  const admin = getSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("group_books")
    .select("material_id, status, position, starts_on, ends_on, finished_on, created_at")
    .eq("group_id", groupId);
  if (error) throw error;
  if (rows.length === 0) return [];

  const [{ data: materials, error: materialsError }, sessions] = await Promise.all([
    admin
      .from("materials")
      .select(MATERIAL_SUMMARY_COLUMNS)
      .in(
        "id",
        rows.map((r) => r.material_id)
      ),
    sessionsPerBook(groupId),
  ]);
  if (materialsError) throw materialsError;
  const byId = new Map(materials.map((m) => [m.id, m]));

  return rows.sort(compareBooks).flatMap((r) => {
    const material = byId.get(r.material_id);
    if (!material) return [];
    return [
      {
        material: toMaterialSummary(material),
        status: r.status,
        startsOn: r.starts_on,
        endsOn: r.ends_on,
        finishedOn: r.finished_on,
        sessions: sessions.get(r.material_id) ?? 0,
      },
    ];
  });
}

/** `book_changed` (spec §7) to every member but the moderator who made the
 * change, after the response. Deduped per book and day, so flipping the
 * current book back and forth doesn't repeat it. */
function notifyBookChanged(group: Group, actorId: string, materialId: string, nowReading: boolean) {
  after(async () => {
    try {
      const admin = getSupabaseAdminClient();
      const [{ data: members }, { data: material }] = await Promise.all([
        admin.from("group_members").select("reader_id").eq("group_id", group.id).neq("reader_id", actorId),
        admin.from("materials").select("title").eq("id", materialId).single(),
      ]);
      if (!members?.length || !material) return;
      await notifyReaders(
        members.map((m) => m.reader_id),
        {
          kind: "book_changed",
          groupId: group.id,
          title: nowReading ? `Now reading: ${material.title}` : `Up next: ${material.title}`,
          body: group.name,
          url: groupHref(group.slug),
          tag: `group-books-${group.id}`,
          actorReaderId: actorId,
          ref: `${group.id}:${materialId}:${nowReading ? "current" : "added"}`,
        }
      );
    } catch (err) {
      console.error("Failed to send book_changed", err);
    }
  });
}

/** The reader's groups whose reading list has the book, in the order they
 * joined them, and whether it's their current book: where a note on it also
 * goes (rooms-spec §5.3). */
export async function readerGroupsWithBook(readerId: string, materialId: string): Promise<{ id: string; current: boolean }[]> {
  const admin = getSupabaseAdminClient();
  const { data: mine, error } = await admin.from("group_members").select("group_id").eq("reader_id", readerId).order("joined_at");
  if (error) throw error;
  if (mine.length === 0) return [];
  const { data: listed, error: listedError } = await admin
    .from("group_books")
    .select("group_id, status")
    .eq("material_id", materialId)
    .in(
      "group_id",
      mine.map((m) => m.group_id)
    );
  if (listedError) throw listedError;
  const status = new Map(listed.map((b) => [b.group_id, b.status]));
  return mine.filter((m) => status.has(m.group_id)).map((m) => ({ id: m.group_id, current: status.get(m.group_id) === "current" }));
}

/** The group the reader's note on the book also shows in, for the reader's
 * "where it goes" line (routeLine); null when there's none. */
export async function noteGroup(readerId: string, materialId: string): Promise<NoteGroup | null> {
  const [first] = await readerGroupsWithBook(readerId, materialId);
  if (!first) return null;
  const { data, error } = await getSupabaseAdminClient().from("groups").select("name, slug").eq("id", first.id).single();
  if (error) throw error;
  return { name: data.name, slug: data.slug, current: first.current };
}

/** From library or after an upload. Only public library books: the list is
 * public (spec §4.6). The first book on an empty list becomes current. */
export async function addGroupBook(group: Group, actorId: string, materialId: string): Promise<GroupOutcome> {
  if (!(await isModerator(group.id, actorId))) return "forbidden";
  const admin = getSupabaseAdminClient();
  const { data: material, error } = await admin
    .from("materials")
    .select("visibility, status")
    .eq("id", materialId)
    .maybeSingle();
  if (error) throw error;
  if (!material || material.status !== "published") return "book_not_found";
  if (material.visibility !== "public") return "book_not_public";

  const { data: added, error: addError } = await admin.rpc("add_group_book", {
    grp: group.id,
    material: materialId,
    reader: actorId,
  });
  if (addError) throw addError;
  if (added === "exists") return "book_exists";
  notifyBookChanged(group, actorId, materialId, added === "current");
  return "ok";
}

export type GroupBookUpdate = {
  /** "Read this now" or "Mark as done". */
  status?: "current" | "done";
  startsOn?: string | null;
  endsOn?: string | null;
};

export async function updateGroupBook(
  group: Group,
  actorId: string,
  materialId: string,
  update: GroupBookUpdate
): Promise<GroupOutcome> {
  if (!(await isModerator(group.id, actorId))) return "forbidden";
  const admin = getSupabaseAdminClient();

  if (update.status === "current") {
    const { data: found, error } = await admin.rpc("set_current_group_book", { grp: group.id, material: materialId, reader: actorId });
    if (error) throw error;
    if (!found) return "book_not_found";
    notifyBookChanged(group, actorId, materialId, true);
  }

  const fields = {
    ...(update.status === "done" && { status: "done" as const, finished_on: localDay(Date.now(), group.timezone) }),
    ...(update.startsOn !== undefined && { starts_on: update.startsOn }),
    ...(update.endsOn !== undefined && { ends_on: update.endsOn }),
  };
  if (Object.keys(fields).length === 0) return "ok";
  const { data, error } = await admin
    .from("group_books")
    .update(fields)
    .eq("group_id", group.id)
    .eq("material_id", materialId)
    .select("material_id");
  if (error) throw error;
  if (!data.length) return "book_not_found";
  if (update.status === "done") postBookFinished(group, actorId, materialId);
  return "ok";
}

/** Rearrange (Manage → Reading list): `materialIds` in their new order. */
export async function reorderGroupBooks(group: Group, actorId: string, materialIds: string[]): Promise<GroupOutcome> {
  if (!(await isModerator(group.id, actorId))) return "forbidden";
  const { error } = await getSupabaseAdminClient().rpc("reorder_group_books", { grp: group.id, materials: materialIds });
  if (error) throw error;
  return "ok";
}

export async function removeGroupBook(group: Group, actorId: string, materialId: string): Promise<GroupOutcome> {
  if (!(await isModerator(group.id, actorId))) return "forbidden";
  const { data, error } = await getSupabaseAdminClient()
    .from("group_books")
    .delete()
    .eq("group_id", group.id)
    .eq("material_id", materialId)
    .select("material_id");
  if (error) throw error;
  return data.length ? "ok" : "book_not_found";
}

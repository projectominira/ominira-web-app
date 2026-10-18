import "server-only";

import { conflict, forbidden, notFound, validationError } from "@/lib/api/errors";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { toAvatar } from "@/lib/avatar/avatar";
import type { GroupMember, GroupPage, GroupRole, GroupSummary } from "@/lib/groups/types";
import { READING_NOW_MS } from "@/lib/rooms/home";

// Membership for the thin app/api/groups/* routes (spec §0, §4.1). Who's a
// member or moderator is is_group_member / is_group_moderator; the
// last-moderator rule is leave_group / set_group_role
// (migrations/20261021_groups.sql). This module calls them and shapes the
// response.

export type Group = {
  id: string;
  slug: string;
  name: string;
  description: string;
  timezone: string;
  pinned_post_id: string | null;
};

/** What a group write can come back with; groupResponse turns it into HTTP. */
export type GroupOutcome =
  | "ok"
  | "not_found"
  | "forbidden"
  | "not_member"
  | "last_moderator"
  | "name_unusable"
  | "name_taken"
  // Reading list (books.ts).
  | "book_not_found"
  | "book_exists"
  | "book_not_public"
  // Notes (notes.ts).
  | "post_not_found"
  // Targets (targets.ts).
  | "no_current_book"
  | "below_start"
  | "due_in_past"
  // Sessions (schedule.ts).
  | "session_not_found"
  | "starts_in_past"
  // Creating (createGroup).
  | "group_cap";

export const GROUP_COLUMNS = "id, slug, name, description, timezone, pinned_post_id";

export async function findGroup(slug: string): Promise<Group | null> {
  const { data, error } = await getSupabaseAdminClient().from("groups").select(GROUP_COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
}

export async function findGroupById(id: string): Promise<Group | null> {
  const { data, error } = await getSupabaseAdminClient().from("groups").select(GROUP_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function roleOf(groupId: string, readerId: string): Promise<GroupRole | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("reader_id", readerId)
    .maybeSingle();
  if (error) throw error;
  return data?.role ?? null;
}

export async function isModerator(groupId: string, readerId: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdminClient().rpc("is_group_moderator", { grp: groupId, reader: readerId });
  if (error) throw error;
  return data;
}

async function memberCount(groupId: string): Promise<number> {
  const { count, error } = await getSupabaseAdminClient()
    .from("group_members")
    .select("reader_id", { count: "exact", head: true })
    .eq("group_id", groupId);
  if (error) throw error;
  return count ?? 0;
}

/** Every group, oldest first, with the viewer's membership. */
export async function listGroups(readerId: string | null): Promise<GroupSummary[]> {
  const admin = getSupabaseAdminClient();
  const [groupsRes, mineRes] = await Promise.all([
    admin.from("groups").select("id, slug, name, description").order("created_at"),
    readerId ? admin.from("group_members").select("group_id").eq("reader_id", readerId) : null,
  ]);
  if (groupsRes.error) throw groupsRes.error;
  if (mineRes?.error) throw mineRes.error;
  const mine = new Set(mineRes?.data.map((m) => m.group_id));
  const counts = await Promise.all(groupsRes.data.map((g) => memberCount(g.id)));
  return groupsRes.data.map((g, i) => ({ ...g, memberCount: counts[i], joined: mine.has(g.id) }));
}

export async function getGroupPage(slug: string, readerId: string | null): Promise<GroupPage | null> {
  const group = await findGroup(slug);
  if (!group) return null;
  const admin = getSupabaseAdminClient();
  const [count, mine, readingNow] = await Promise.all([
    memberCount(group.id),
    readerId ? admin.from("group_members").select("role, muted").eq("group_id", group.id).eq("reader_id", readerId).maybeSingle() : null,
    readingNowIn(group.id, readerId),
  ]);
  if (mine?.error) throw mine.error;
  const { id, name, description } = group;
  return { group: { id, slug, name, description, memberCount: count }, myRole: mine?.data?.role ?? null, muted: mine?.data?.muted ?? false, readingNow };
}

/** Mute or unmute the group for one member (studygroup-spec §7): its kinds
 * stop reaching them, mentions still do (lib/notifications/notify.ts). */
export async function setMuted(groupId: string, readerId: string, muted: boolean): Promise<GroupOutcome> {
  const { data, error } = await getSupabaseAdminClient()
    .from("group_members")
    .update({ muted })
    .eq("group_id", groupId)
    .eq("reader_id", readerId)
    .select("reader_id");
  if (error) throw error;
  return data.length ? "ok" : "not_member";
}

/** Members who saved a reading position in the last 15 minutes on a book
 * they haven't finished (Home's rule, READING_NOW_MS), never the viewer. */
async function readingNowIn(groupId: string, viewerId: string | null): Promise<number> {
  const admin = getSupabaseAdminClient();
  const { data: members, error } = await admin.from("group_members").select("reader_id").eq("group_id", groupId);
  if (error) throw error;
  const ids = members.map((m) => m.reader_id).filter((id) => id !== viewerId);
  if (ids.length === 0) return 0;
  const { data, error: readingError } = await admin
    .from("reader_activities")
    .select("reader_id")
    .in("reader_id", ids)
    .is("finished_at", null)
    .gt("updated_at", new Date(Date.now() - READING_NOW_MS).toISOString());
  if (readingError) throw readingError;
  return new Set(data.map((r) => r.reader_id)).size;
}

/** Moderators first, then by when they joined. */
export async function listMembers(groupId: string): Promise<GroupMember[]> {
  const admin = getSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("group_members")
    .select("reader_id, role, joined_at")
    .eq("group_id", groupId)
    .order("joined_at");
  if (error) throw error;
  if (rows.length === 0) return [];

  const { data: readers, error: readersError } = await admin
    .from("readers")
    .select("id, pseudonym, avatar_color, avatar_url")
    .in(
      "id",
      rows.map((r) => r.reader_id)
    );
  if (readersError) throw readersError;
  const byId = new Map(readers.map((r) => [r.id, r]));

  return rows
    .flatMap((r) => {
      const reader = byId.get(r.reader_id);
      if (!reader) return [];
      return [{ readerId: r.reader_id, pseudonym: reader.pseudonym, avatar: toAvatar(reader), role: r.role, joinedAt: r.joined_at }];
    })
    .sort((a, b) => Number(b.role === "moderator") - Number(a.role === "moderator"));
}

/** Instant and idempotent (§4.1): joining twice keeps the first row and role. */
export async function joinGroup(groupId: string, readerId: string): Promise<void> {
  const { error } = await getSupabaseAdminClient()
    .from("group_members")
    .upsert({ group_id: groupId, reader_id: readerId }, { onConflict: "group_id,reader_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function leaveGroup(groupId: string, readerId: string): Promise<GroupOutcome> {
  const { data, error } = await getSupabaseAdminClient().rpc("leave_group", { grp: groupId, reader: readerId });
  if (error) throw error;
  return data === "left" ? "ok" : data;
}

/** Moderators only (M10). */
export async function removeMember(groupId: string, actorId: string, readerId: string): Promise<GroupOutcome> {
  if (!(await isModerator(groupId, actorId))) return "forbidden";
  return leaveGroup(groupId, readerId);
}

/** Moderators only (M10): promote, or step down / demote. */
export async function setMemberRole(
  groupId: string,
  actorId: string,
  readerId: string,
  role: GroupRole
): Promise<GroupOutcome> {
  if (!(await isModerator(groupId, actorId))) return "forbidden";
  const { data, error } = await getSupabaseAdminClient().rpc("set_group_role", {
    grp: groupId,
    reader: readerId,
    new_role: role,
  });
  if (error) throw error;
  return data === "updated" ? "ok" : data;
}

/** Moderators only (M6). */
/** A group name, url-safe: accents dropped, every other run of
 * non-alphanumerics one hyphen ("Sankara Study Circle" -> "sankara-study-circle"). */
export function groupNameToSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Groups one reader can have started, so creating stays a reader's act
 * and not a spammer's. */
export const GROUP_CREATE_CAP = 5;

/** A reader starts a group and moderates it. The slug is the name's; a name
 * another group's slug already has gets a short suffix rather than a
 * refusal. Sessions recur in the creator's zone. */
export async function createGroup(
  readerId: string,
  input: { name: string; description: string }
): Promise<GroupOutcome | { slug: string }> {
  const base = groupNameToSlug(input.name);
  if (base === "") return "name_unusable";
  const admin = getSupabaseAdminClient();
  const [started, reader] = await Promise.all([
    admin.from("groups").select("id", { count: "exact", head: true }).eq("created_by", readerId),
    admin.from("readers").select("timezone").eq("id", readerId).single(),
  ]);
  if (started.error) throw started.error;
  if (reader.error) throw reader.error;
  if ((started.count ?? 0) >= GROUP_CREATE_CAP) return "group_cap";

  const insert = (slug: string) =>
    admin
      .from("groups")
      .insert({ slug, name: input.name, description: input.description, timezone: reader.data.timezone ?? "UTC", created_by: readerId })
      .select("id, slug")
      .single();
  let created = await insert(base);
  if (created.error?.code === "23505") created = await insert(`${base}-${crypto.randomUUID().slice(0, 4)}`);
  if (created.error) throw created.error;

  const { error } = await admin.from("group_members").insert({ group_id: created.data.id, reader_id: readerId, role: "moderator" });
  if (error) {
    // A group with no moderator can't be run; take it back.
    await admin.from("groups").delete().eq("id", created.data.id);
    throw error;
  }
  return { slug: created.data.slug };
}

/** Name and description (moderators only). A new name moves the group to
 * its slug, so the outcome on success is the slug it now lives at. */
export async function updateGroup(
  groupId: string,
  actorId: string,
  update: { name?: string; description?: string }
): Promise<GroupOutcome | { slug: string }> {
  if (!(await isModerator(groupId, actorId))) return "forbidden";
  const slug = update.name === undefined ? undefined : groupNameToSlug(update.name);
  if (slug === "") return "name_unusable";
  const { data, error } = await getSupabaseAdminClient()
    .from("groups")
    .update({ ...update, ...(slug && { slug }) })
    .eq("id", groupId)
    .select("slug")
    .single();
  if (error?.code === "23505") return "name_taken";
  if (error) throw error;
  return { slug: data.slug };
}

/** Deletes the group (moderators only). Its members, list, targets, sessions,
 * rooms and milestones go with it; notes posted in it keep their
 * visibility and lose the group (`posts.group_id` set null). */
export async function deleteGroup(groupId: string, actorId: string): Promise<GroupOutcome> {
  if (!(await isModerator(groupId, actorId))) return "forbidden";
  const { error } = await getSupabaseAdminClient().from("groups").delete().eq("id", groupId);
  if (error) throw error;
  return "ok";
}

/** The one response for a group write. */
export function groupResponse(outcome: GroupOutcome) {
  switch (outcome) {
    case "ok":
      return new Response(null, { status: 204 });
    case "not_found":
      return notFound("No group found.");
    case "forbidden":
      return forbidden("Only moderators can do this.");
    case "not_member":
      return notFound("Not a member of this group.");
    case "last_moderator":
      return conflict("Make another comrade a moderator first.");
    case "name_unusable":
      return validationError("Use some letters or numbers in the name.", "name");
    case "name_taken":
      return conflict("Another group already has that name.");
    case "book_not_found":
      return notFound("That book isn't on the reading list.");
    case "book_exists":
      return conflict("That book is already on the reading list.");
    case "book_not_public":
      return forbidden("Only public books can go on a group's reading list.");
    case "post_not_found":
      return notFound("No note found.");
    case "no_current_book":
      return conflict("Choose the book you're reading now first.");
    case "below_start":
      return validationError("Pick a point past last week's stop.", "endPct");
    case "due_in_past":
      return validationError("Pick a day from today on.", "dueOn");
    case "session_not_found":
      return notFound("No upcoming session found.");
    case "starts_in_past":
      return validationError("Pick a time that's still to come.", "startsAt");
    case "group_cap":
      return conflict(`You've started ${GROUP_CREATE_CAP} groups, the most one reader can.`);
  }
}

/** Everyone who shares a group with this reader, themself excluded. */
export async function groupComradeIds(readerId: string): Promise<string[]> {
  const admin = getSupabaseAdminClient();
  const { data: mine, error } = await admin.from("group_members").select("group_id").eq("reader_id", readerId);
  if (error) throw error;
  if (mine.length === 0) return [];
  const { data, error: membersError } = await admin
    .from("group_members")
    .select("reader_id")
    .in(
      "group_id",
      mine.map((m) => m.group_id)
    )
    .neq("reader_id", readerId);
  if (membersError) throw membersError;
  return [...new Set(data.map((m) => m.reader_id))];
}

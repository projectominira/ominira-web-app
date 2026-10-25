import "server-only";

import { conflict, forbidden, notFound, validationError } from "@/lib/api/errors";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { groupHref } from "@/lib/groups/copy";
import { toAvatar } from "@/lib/avatar/avatar";
import type { GroupMember, GroupPage, GroupPin, GroupRole, GroupSummary } from "@/lib/groups/types";
import { READING_NOW_MS } from "@/lib/rooms/home";
import { notificationSnippet } from "@/lib/notifications/snippet";

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
  pin_target: boolean;
  pinned_session_id: string | null;
  is_private: boolean;
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
  | "group_cap"
  // Joining.
  | "invite_only";

export const GROUP_COLUMNS = "id, slug, name, description, timezone, pinned_post_id, pin_target, pinned_session_id, is_private";

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

/** Every public group, oldest first, with the viewer's membership; private
 * ones only for their members. */
export async function listGroups(readerId: string | null): Promise<GroupSummary[]> {
  const admin = getSupabaseAdminClient();
  const [groupsRes, mineRes] = await Promise.all([
    admin.from("groups").select("id, slug, name, description, is_private").order("created_at"),
    readerId ? admin.from("group_members").select("group_id").eq("reader_id", readerId) : null,
  ]);
  if (groupsRes.error) throw groupsRes.error;
  if (mineRes?.error) throw mineRes.error;
  const mine = new Set(mineRes?.data.map((m) => m.group_id));
  const groups = groupsRes.data.filter((g) => !g.is_private || mine.has(g.id));
  const counts = await Promise.all(groups.map((g) => memberCount(g.id)));
  return groups.map(({ is_private: _, ...g }, i) => ({ ...g, memberCount: counts[i], joined: mine.has(g.id) }));
}

/** The page header, from one read of the members: the count, the viewer's
 * own row and who's reading now. */
export async function getGroupPage(group: Group, readerId: string | null): Promise<GroupPage> {
  const { data: members, error } = await getSupabaseAdminClient().from("group_members").select("reader_id, role, muted").eq("group_id", group.id);
  if (error) throw error;
  const mine = members.find((m) => m.reader_id === readerId);
  const [readingNow, note] = await Promise.all([
    readingNowAmong(members.flatMap((m) => (m.reader_id === readerId ? [] : [m.reader_id]))),
    pinnedNote(group),
  ]);
  const { id, slug, name, description, is_private } = group;
  return { group: { id, slug, name, description, memberCount: members.length, private: is_private }, myRole: mine?.role ?? null, muted: mine?.muted ?? false, readingNow, pins: { note, target: group.pin_target, session: group.pinned_session_id } };
}

/** The note pinned to the room's strip; null when none, or it's gone. */
async function pinnedNote(group: Group): Promise<GroupPin | null> {
  if (!group.pinned_post_id) return null;
  const admin = getSupabaseAdminClient();
  const { data: post, error } = await admin.from("posts").select("id, reader_id, content, visibility").eq("id", group.pinned_post_id).maybeSingle();
  if (error) throw error;
  if (!post || post.visibility !== "public") return null;
  const { data: author, error: authorError } = await admin.from("readers").select("pseudonym").eq("id", post.reader_id).maybeSingle();
  if (authorError) throw authorError;
  return { id: post.id, text: notificationSnippet((post.content as { text?: string }).text) ?? "A note", author: author?.pseudonym ?? "" };
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

/** Of these readers (the members but the viewer), those who saved a reading
 * position in the last 15 minutes on a book they haven't finished (Home's
 * rule, READING_NOW_MS). */
async function readingNowAmong(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { data, error } = await getSupabaseAdminClient()
    .from("reader_activities")
    .select("reader_id")
    .in("reader_id", ids)
    .is("finished_at", null)
    .gt("updated_at", new Date(Date.now() - READING_NOW_MS).toISOString());
  if (error) throw error;
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

/** Whether a moderator has invited this reader to the group (the tagged
 * `group_invite` notification, which opens the group's page). */
export async function isInvited(group: Group, readerId: string): Promise<boolean> {
  const { count, error } = await getSupabaseAdminClient()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("reader_id", readerId)
    .eq("kind", "group_invite")
    .eq("url", groupHref(group.slug));
  if (error) throw error;
  return (count ?? 0) > 0;
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
  input: { name: string; description: string; isPrivate: boolean }
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
      .insert({ slug, name: input.name, description: input.description, is_private: input.isPrivate, timezone: reader.data.timezone ?? "UTC", created_by: readerId })
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
    case "invite_only":
      return forbidden("This group is invite only.");
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

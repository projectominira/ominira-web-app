import "server-only";

import { after } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { toAvatar } from "@/lib/avatar/avatar";
import { notifyReaders } from "@/lib/notifications/notify";
import { notificationSnippet } from "@/lib/notifications/snippet";
import { comradeName } from "@/lib/reader/authorDisplay";
import { MAX_MENTIONS, type MentionCandidate } from "@/lib/community/mentionTypes";

// Mentions (studygroup-spec.md §3.3, §4.5): who a post tags, the `mention`
// notification, and the composer's suggestions. A tagged reader can read the
// post even when it's private (lib/community/visibility.ts).

export { MAX_MENTIONS };
const SUGGESTIONS = 8;

/** The tagged readers that exist, minus the author. */
export async function existingReaders(readerIds: string[], authorId: string): Promise<string[]> {
  const unique = [...new Set(readerIds)].filter((id) => id !== authorId).slice(0, MAX_MENTIONS);
  if (unique.length === 0) return [];
  const { data, error } = await getSupabaseAdminClient().from("readers").select("id").in("id", unique);
  if (error) throw error;
  return data.map((r) => r.id);
}

export async function savePostMentions(postId: string, readerIds: string[]): Promise<void> {
  if (readerIds.length === 0) return;
  const { error } = await getSupabaseAdminClient()
    .from("post_mentions")
    .insert(readerIds.map((reader_id) => ({ post_id: postId, reader_id })));
  if (error) throw error;
}

/** `mention` to everyone tagged and, for Whole circle, every member of the
 * group, after the response. One per post and reader (policy dedupe). */
export function notifyMentioned(post: {
  id: string;
  text: string | null;
  authorId: string;
  readerIds: string[];
  /** Whole circle: every member of this group is told too. */
  circle: { id: string } | null;
  /** Where it was posted, for the "· Sankara Study Circle" line. */
  groupName: string | null;
}) {
  after(async () => {
    try {
      const admin = getSupabaseAdminClient();
      const [{ data: actor }, members] = await Promise.all([
        admin.from("readers").select("pseudonym").eq("id", post.authorId).maybeSingle(),
        post.circle
          ? admin.from("group_members").select("reader_id").eq("group_id", post.circle.id)
          : Promise.resolve({ data: [] as { reader_id: string }[] }),
      ]);
      const recipients = [...post.readerIds, ...(members.data ?? []).map((m) => m.reader_id)].filter(
        (id) => id !== post.authorId
      );
      if (recipients.length === 0) return;
      const name = actor?.pseudonym ? comradeName(actor.pseudonym) : "A comrade";
      const quoted = notificationSnippet(post.text);
      await notifyReaders(recipients, {
        kind: "mention",
        title: post.groupName ? `${name} mentioned you · ${post.groupName}` : `${name} mentioned you`,
        body: quoted ? `“${quoted}”` : "Tap to read the note",
        url: `/post/${post.id}`,
        tag: `mention-${post.id}`,
        actorReaderId: post.authorId,
        snippet: post.text,
        ref: post.id,
      });
    } catch (err) {
      console.error("Failed to send mention", err);
    }
  });
}

/** The tag picker before a name is typed: the comrades you've engaged with,
 * either way round — mentions, then replies, then reactions (SQL
 * `mention_comrades`). */
async function recentComradeIds(viewerId: string): Promise<string[]> {
  const { data, error } = await getSupabaseAdminClient().rpc("mention_comrades", { reader: viewerId, max_rows: SUGGESTIONS });
  if (error) throw error;
  return data.map((r) => r.reader_id);
}

/** Tag suggestions (the composer, the group Invite). With a query: comrades
 * whose name matches, the group's members first. Without one: the comrades
 * you've engaged with (recentComradeIds). */
export async function mentionCandidates(
  viewerId: string,
  query: string,
  groupId: string | null
): Promise<MentionCandidate[]> {
  const admin = getSupabaseAdminClient();
  const q = query.trim();

  let ids: string[];
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const { data, error } = await admin
      .from("readers")
      .select("id")
      .ilike("pseudonym", pattern)
      .neq("id", viewerId)
      .limit(SUGGESTIONS * 3);
    if (error) throw error;
    ids = data.map((r) => r.id);
  } else {
    ids = await recentComradeIds(viewerId);
  }
  if (ids.length === 0) return [];

  const [readers, roles] = await Promise.all([
    admin.from("readers").select("id, pseudonym, avatar_color, avatar_url").in("id", ids),
    groupId
      ? admin.from("group_members").select("reader_id, role").eq("group_id", groupId).in("reader_id", ids)
      : Promise.resolve({ data: [] as { reader_id: string; role: "moderator" | "member" }[], error: null }),
  ]);
  if (readers.error) throw readers.error;
  if (roles.error) throw roles.error;
  const roleOf = new Map((roles.data ?? []).map((r) => [r.reader_id, r.role]));
  const byId = new Map(readers.data.map((r) => [r.id, r]));

  const candidates = ids.flatMap((id) => {
    const reader = byId.get(id);
    if (!reader) return [];
    return [{ readerId: id, pseudonym: reader.pseudonym, avatar: toAvatar(reader), role: roleOf.get(id) ?? null }];
  });
  if (!q) return candidates;
  // Members first, then the closest names (prefix before substring).
  const lower = q.toLowerCase();
  const rank = (c: MentionCandidate) => (c.role ? 0 : 2) + (c.pseudonym.toLowerCase().startsWith(lower) ? 0 : 1);
  return candidates.sort((a, b) => rank(a) - rank(b) || a.pseudonym.localeCompare(b.pseudonym)).slice(0, SUGGESTIONS);
}

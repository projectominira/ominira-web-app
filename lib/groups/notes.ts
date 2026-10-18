import "server-only";

import { after } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { notifyReaders } from "@/lib/notifications/notify";
import { notificationSnippet } from "@/lib/notifications/snippet";
import { comradeName } from "@/lib/reader/authorDisplay";
import { isModerator, roleOf, type Group, type GroupOutcome } from "@/lib/groups/membership";

// Notes in the group (studygroup-spec.md §4.5): who may post to it, and the
// pin, for the thin note and /pin routes. The room's stream is
// lib/rooms/stream.ts.

/** Posting to the group: members only, and Whole circle is for moderators. */
export async function groupPostAccess(groupId: string, readerId: string, wholeCircle: boolean): Promise<GroupOutcome> {
  const role = await roleOf(groupId, readerId);
  if (!role) return "not_member";
  if (wholeCircle && role !== "moderator") return "forbidden";
  return "ok";
}

/** Pin to top, or unpin with null. One pin per group, so a new pin replaces
 * the old one. Moderators only; members hear about it (`group_post`). */
export async function pinGroupPost(group: Group, actorId: string, postId: string | null): Promise<GroupOutcome> {
  if (!(await isModerator(group.id, actorId))) return "forbidden";
  const admin = getSupabaseAdminClient();

  let text: string | null = null;
  if (postId) {
    const { data: post, error } = await admin.from("posts").select("parent_id, content").eq("id", postId).maybeSingle();
    if (error) throw error;
    if (!post || post.parent_id) return "post_not_found";
    text = (post.content as { text?: string }).text ?? null;
  }

  const { error } = await admin.from("groups").update({ pinned_post_id: postId }).eq("id", group.id);
  if (error) throw error;
  if (postId && postId !== group.pinned_post_id) notifyPinned(group, actorId, postId, text);
  return "ok";
}

function notifyPinned(group: Group, actorId: string, postId: string, text: string | null) {
  after(async () => {
    try {
      const admin = getSupabaseAdminClient();
      const [{ data: members }, { data: actor }] = await Promise.all([
        admin.from("group_members").select("reader_id").eq("group_id", group.id).neq("reader_id", actorId),
        admin.from("readers").select("pseudonym").eq("id", actorId).maybeSingle(),
      ]);
      if (!members?.length) return;
      const name = actor?.pseudonym ? comradeName(actor.pseudonym) : "A moderator";
      const quoted = notificationSnippet(text);
      await notifyReaders(
        members.map((m) => m.reader_id),
        {
          kind: "group_post",
          groupId: group.id,
          title: `${name} pinned a note in ${group.name}`,
          body: quoted ? `“${quoted}”` : group.name,
          url: `/post/${postId}`,
          tag: `group-pin-${group.id}`,
          actorReaderId: actorId,
          snippet: text,
          ref: postId,
        }
      );
    } catch (err) {
      console.error("Failed to send group_post", err);
    }
  });
}

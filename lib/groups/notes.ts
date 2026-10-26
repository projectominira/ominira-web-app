import "server-only";

import { after } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { notifyReaders } from "@/lib/notifications/notify";
import { notificationSnippet } from "@/lib/notifications/snippet";
import { comradeName } from "@/lib/reader/authorDisplay";
import { isModerator, roleOf, type Group, type GroupOutcome } from "@/lib/groups/membership";

// Notes in the group (studygroup-spec.md §4.5): who may post to it, and the
// strip's pins (a note, the target, a session), for the thin note and /pin
// routes. The room's stream is
// lib/rooms/stream.ts.

/** Posting to the group: members only, and Whole circle is for moderators. */
export async function groupPostAccess(groupId: string, readerId: string, wholeCircle: boolean): Promise<GroupOutcome> {
  const role = await roleOf(groupId, readerId);
  if (!role) return "not_member";
  if (wholeCircle && role !== "moderator") return "forbidden";
  return "ok";
}

/** What a pin request sets; absent keys stay as they are. */
export type PinInput = { postId?: string | null; target?: boolean; sessionId?: string | null };

/** Pins to the room's strip, or unpins with null / false. Moderators only.
 * A note: one per group (a new pin replaces the old), a public note posted
 * in the group, not a reply; members hear about it (`group_post`). The
 * target: whichever is running. A session: one, by its series for a weekly
 * one, so the pin follows it. */
export async function pinInGroup(group: Group, actorId: string, input: PinInput): Promise<GroupOutcome> {
  if (!(await isModerator(group.id, actorId))) return "forbidden";
  const admin = getSupabaseAdminClient();
  const { postId, target, sessionId } = input;

  let text: string | null = null;
  if (postId) {
    const { data: post, error } = await admin.from("posts").select("parent_id, content, group_id, visibility").eq("id", postId).maybeSingle();
    if (error) throw error;
    if (!post || post.parent_id || post.group_id !== group.id || post.visibility !== "public") return "post_not_found";
    text = (post.content as { text?: string }).text ?? null;
  }
  let session: string | null | undefined = sessionId;
  if (sessionId) {
    const { data: row, error } = await admin.from("group_sessions").select("id, series_id").eq("id", sessionId).eq("group_id", group.id).maybeSingle();
    if (error) throw error;
    if (!row) return "not_found";
    session = row.series_id ?? row.id;
  }

  const update = {
    ...(postId !== undefined && { pinned_post_id: postId }),
    ...(target !== undefined && { pin_target: target }),
    ...(session !== undefined && { pinned_session_id: session }),
  };
  const { error } = await admin.from("groups").update(update).eq("id", group.id);
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
          url: `/note/${postId}`,
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

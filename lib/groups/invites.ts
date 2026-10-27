import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { existingReaders } from "@/lib/community/mentions";
import { groupHref } from "@/lib/groups/copy";
import { isModerator, type Group, type GroupOutcome } from "@/lib/groups/membership";
import { notifyReaders } from "@/lib/notifications/notify";
import { notificationSnippet } from "@/lib/notifications/snippet";

/** A moderator's tagged invite: `group_invite` to every tagged reader who
 * isn't a member yet. Title the group's name, body its description, then
 * who invited them; it opens the group page. One per group and reader a
 * day (policy dedupe). */
export async function inviteToGroup(group: Group, actorId: string, readerIds: string[]): Promise<GroupOutcome> {
  if (!(await isModerator(group.id, actorId))) return "forbidden";
  const admin = getSupabaseAdminClient();
  const tagged = await existingReaders(readerIds, actorId);
  if (tagged.length === 0) return "ok";

  const [{ data: members, error }, { data: actor }] = await Promise.all([
    admin.from("group_members").select("reader_id").eq("group_id", group.id).in("reader_id", tagged),
    admin.from("readers").select("pseudonym").eq("id", actorId).maybeSingle(),
  ]);
  if (error) throw error;
  const joined = new Set(members.map((m) => m.reader_id));
  const recipients = tagged.filter((id) => !joined.has(id));
  if (recipients.length === 0) return "ok";

  const invited = `${actor?.pseudonym || "A comrade"} invited you to join`;
  const description = notificationSnippet(group.description);
  await notifyReaders(recipients, {
    kind: "group_invite",
    title: group.name,
    body: description ? `${description}\n${invited}` : invited,
    url: groupHref(group.slug),
    tag: `group-invite-${group.id}`,
    actorReaderId: actorId,
    snippet: group.description || null,
    ref: group.id,
  });
  return "ok";
}

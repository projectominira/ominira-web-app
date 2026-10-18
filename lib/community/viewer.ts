import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import type { PostViewer } from "@/lib/community/visibility";

/** The viewer's read grants for lib/community/visibility.ts: the posts
 * they're tagged in and the groups they've joined. Two small reads, once per
 * request. Null signed out. */
export async function loadPostViewer(readerId: string | undefined | null): Promise<PostViewer> {
  if (!readerId) return null;
  const admin = getSupabaseAdminClient();
  const [mentions, groups] = await Promise.all([
    admin.from("post_mentions").select("post_id").eq("reader_id", readerId),
    admin.from("group_members").select("group_id").eq("reader_id", readerId),
  ]);
  if (mentions.error) throw mentions.error;
  if (groups.error) throw groups.error;
  return {
    readerId,
    mentionedPostIds: mentions.data.map((m) => m.post_id),
    groupIds: groups.data.map((g) => g.group_id),
  };
}

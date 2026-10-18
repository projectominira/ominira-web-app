// Who can read a post (studygroup-spec.md §4.5): public, or private and the
// viewer is its author, is tagged in it, or is a member of the group it was
// shared with ("Whole circle"). The TypeScript twin of SQL `can_read_post`
// (migrations/20261024_group_notes.sql); every feed and single-post read goes
// through one of these two, never an inline check. Pure: the viewer's grants
// are loaded once per request (lib/community/viewer.ts).

/** What a signed-in viewer can see beyond public posts. Null signed out. */
export type PostViewer = {
  readerId: string;
  /** Posts the viewer is tagged in. */
  mentionedPostIds: string[];
  /** Groups the viewer has joined. */
  groupIds: string[];
} | null;

type PostAccess = { id: string; visibility: "public" | "private"; reader_id: string; mentions_group_id: string | null };

export function canReadPost(post: PostAccess, viewer: PostViewer): boolean {
  if (post.visibility === "public") return true;
  if (!viewer) return false;
  return (
    post.reader_id === viewer.readerId ||
    viewer.mentionedPostIds.includes(post.id) ||
    (post.mentions_group_id !== null && viewer.groupIds.includes(post.mentions_group_id))
  );
}

/** The same rule as a PostgREST `.or()` filter, for queries. */
export function visiblePostsFilter(viewer: PostViewer): string {
  if (!viewer) return "visibility.eq.public";
  const clauses = ["visibility.eq.public", `reader_id.eq.${viewer.readerId}`];
  if (viewer.mentionedPostIds.length) clauses.push(`id.in.(${viewer.mentionedPostIds.join(",")})`);
  if (viewer.groupIds.length) clauses.push(`mentions_group_id.in.(${viewer.groupIds.join(",")})`);
  return clauses.join(",");
}

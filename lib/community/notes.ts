import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import type { Database } from "@/lib/supabase/database.types";
import type { AnnotationRange, Note, NoteContent } from "@/lib/api/types";
import { getBookmarkedIds } from "@/lib/bookmarks/store";
import { toAvatar, type Avatar } from "@/lib/avatar/avatar";

// Backed by `posts` (migrations/20260919_topics_and_posts.sql), not `notes`
// — kept under the old name so the notes-reading routes (which only ever do
// `.from(...)` / `row.reaction_count` / `row.created_at` / `row.id`, all
// present unchanged on `posts`) don't need touching beyond the table name
// swap. A real NoteRow -> PostRow rename is deferred to whenever the public
// Note/NoteContent types themselves get renamed to Post/PostContent.
export type NoteRow = Database["public"]["Tables"]["posts"]["Row"];

export type PostKind = "citation" | "text" | "book_share" | "voice";

/** NoteContent union -> posts.kind + posts.content (jsonb). A text note
 * defaults to kind='citation' (posts.kind has more values than the API's
 * NoteContent.kind ever exposes) — the book-anchored-note shape every
 * existing caller (NoteComposer, reader annotation flow) relies on,
 * unchanged. `kind` lets a caller override that default for a top-level
 * discussion post instead (POST /api/community/notes' own `text`/
 * `book_share` per whether one has an attached material) — contentFromRow
 * reads any non-voice kind back as plain text regardless, so this never
 * needs its own read-side branch. */
export function contentToColumns(content: NoteContent, kind: PostKind = "citation") {
  if (content.kind === "voice") {
    return {
      kind: "voice" as const,
      content: { kind: "voice", audioUrl: content.audioUrl, durationMs: content.durationMs },
    };
  }
  return { kind, content: { kind, text: content.text } };
}

function contentFromRow(row: NoteRow): NoteContent {
  const content = row.content as { text?: string; audioUrl?: string; durationMs?: number };
  if (row.kind === "voice") {
    return { kind: "voice", audioUrl: content.audioUrl!, durationMs: content.durationMs! };
  }
  return { kind: "text", text: content.text! };
}

type AuthorMeta = { pseudonym: string; city: string | null; avatar: Avatar | null };

/** A note's group label (Community notes' "· Sankara Study Circle") and who
 * it tags. */
export type NoteGroup = { slug: string; name: string };
export type NoteMention = { readerId: string; pseudonym: string };

/** snake_case posts row -> camelCase Note (api-spec.md's Shared Types,
 * unchanged even though the row is now a posts row). Author metadata, the
 * group label, mentions and the caller's own reacted/bookmarked flags are
 * looked up separately (no typed FK embedding — see the helpers below) and
 * passed in rather than queried per-row, so a list of N notes costs a few
 * extra queries, not N per note. materialId/ranges are null only for a
 * book-less discussion post — every book-anchored note/reply this endpoint
 * family reads always has both.
 *
 * The two per-caller flags travel as one object rather than two positional
 * booleans: they're the same type, adjacent, and mean opposite things, so a
 * transposed pair would type-check cleanly and silently render every note
 * saved-but-not-reacted. */
export function toNote(
  row: NoteRow,
  author: AuthorMeta,
  flags: { reactedByMe: boolean; bookmarkedByMe: boolean },
  group: NoteGroup | null,
  mentions: NoteMention[]
): Note {
  return {
    id: row.id,
    materialId: row.material_id,
    author: { readerId: row.reader_id, ...author },
    ranges: (row.ranges as AnnotationRange[] | null) ?? [],
    parentId: row.parent_id,
    replyingToId: row.replying_to_id,
    content: contentFromRow(row),
    visibility: row.visibility,
    reactionCount: row.reaction_count,
    reactedByMe: flags.reactedByMe,
    bookmarkedByMe: flags.bookmarkedByMe,
    group,
    mentions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAuthorsByReaderId(readerIds: string[]): Promise<Map<string, AuthorMeta>> {
  const unique = Array.from(new Set(readerIds));
  if (unique.length === 0) return new Map();
  const { data } = await getSupabaseAdminClient().from("readers").select("id, pseudonym, city, avatar_color, avatar_url")
    .in("id", unique);
  return new Map((data ?? []).map((r) => [r.id, { pseudonym: r.pseudonym, city: r.city, avatar: toAvatar(r) }]));
}

/** Batched group labels, same shape as getAuthorsByReaderId. */
async function getGroupsById(groupIds: string[]): Promise<Map<string, NoteGroup>> {
  const unique = Array.from(new Set(groupIds));
  if (unique.length === 0) return new Map();
  const { data } = await getSupabaseAdminClient().from("groups").select("id, slug, name").in("id", unique);
  return new Map((data ?? []).map((g) => [g.id, { slug: g.slug, name: g.name }]));
}

/** Every post's tagged comrades, one query for the batch (plus one for their
 * names). */
async function getMentionsForPosts(postIds: string[]): Promise<Map<string, NoteMention[]>> {
  if (postIds.length === 0) return new Map();
  const { data } = await getSupabaseAdminClient()
    .from("post_mentions")
    .select("post_id, reader_id")
    .in("post_id", postIds)
    .order("created_at");
  const rows = data ?? [];
  const names = await getAuthorsByReaderId(rows.map((r) => r.reader_id));
  const byPost = new Map<string, NoteMention[]>();
  for (const row of rows) {
    const reader = names.get(row.reader_id);
    if (!reader) continue;
    byPost.set(row.post_id, [...(byPost.get(row.post_id) ?? []), { readerId: row.reader_id, pseudonym: reader.pseudonym }]);
  }
  return byPost;
}

export async function getReactedNoteIds(readerId: string | undefined, noteIds: string[]): Promise<Set<string>> {
  if (!readerId || noteIds.length === 0) return new Set();
  const { data } = await getSupabaseAdminClient()
    .from("reactions")
    .select("target_id")
    .eq("target_type", "post")
    .eq("reader_id", readerId)
    .in("target_id", noteIds);
  return new Set((data ?? []).map((r) => r.target_id));
}

/** Batch-hydrates a set of note rows into full Note[] — one author query,
 * one reactions query, one bookmarks query, one group query and one mentions
 * query for the whole batch, in the same reply/thread hydration shape every
 * notes-reading route needs. */
export async function hydrateNotes(rows: NoteRow[], callerId: string | undefined): Promise<Note[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [authors, reacted, bookmarked, groups, mentions] = await Promise.all([
    getAuthorsByReaderId(rows.map((r) => r.reader_id)),
    getReactedNoteIds(callerId, ids),
    // Same batch-per-page shape as getReactedNoteIds above, and likewise a
    // no-op empty set for a signed-out caller.
    getBookmarkedIds(callerId, "post", ids),
    getGroupsById(rows.flatMap((r) => (r.group_id ? [r.group_id] : []))),
    getMentionsForPosts(ids),
  ]);
  return rows.map((row) =>
    toNote(
      row,
      authors.get(row.reader_id) ?? { pseudonym: "Unknown", city: null, avatar: null },
      { reactedByMe: reacted.has(row.id), bookmarkedByMe: bookmarked.has(row.id) },
      (row.group_id && groups.get(row.group_id)) || null,
      mentions.get(row.id) ?? []
    )
  );
}

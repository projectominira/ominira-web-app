import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { notFound, unauthorized, validationError } from "@/lib/api/errors";
import { decodeCursor, encodeCursor, keysetBeforeFilter, type Keyset } from "@/lib/api/cursor";
import { resolveMaterialRow } from "@/lib/materials/resolve";
import { contentToColumns, hydrateNotes, type NoteRow } from "@/lib/community/notes";
import { canReadPost, visiblePostsFilter, type PostViewer } from "@/lib/community/visibility";
import { loadPostViewer } from "@/lib/community/viewer";
import { MAX_MENTIONS, existingReaders, notifyMentioned, savePostMentions } from "@/lib/community/mentions";
import { findGroup, groupResponse } from "@/lib/groups/membership";
import { groupPostAccess } from "@/lib/groups/notes";
import { readerGroupsWithBook } from "@/lib/groups/books";
import { routeNote } from "@/lib/rooms/routing";
import { enrichFeedItems } from "@/lib/community/feed";
import type { AnnotationRange, NoteContent } from "@/lib/api/types";
import { notifyReaders } from "@/lib/notifications/notify";
import { notificationSnippet } from "@/lib/notifications/snippet";
import { cdnUrl } from "@/lib/storage/r2";

type Sort = "recent" | "top" | "trending";
type TopCursor = { reactionCount: number; createdAt: string; id: string };
// Trending's window is candidates only, re-scored on every request — the
// cursor just needs to know where the caller left off in that ranking, not
// a stable value that survives new reactions landing in between (see the
// "recompute + find index" approach below).
type TrendingCursor = { id: string };

const TRENDING_WINDOW_DAYS = 14;
const TRENDING_CANDIDATE_CAP = 300;

function trendingScore(row: NoteRow): number {
  const hoursSinceCreated = (Date.now() - new Date(row.created_at).getTime()) / 3_600_000;
  return row.reaction_count / Math.pow(hoursSinceCreated + 2, 1.5);
}

async function fetchPage(sort: Sort, limit: number, cursor: unknown, viewer: PostViewer) {
  const admin = getSupabaseAdminClient();
  // One chronological stream (no topic filter, spec §4.5): every top-level
  // post the viewer can read, private ones they're in included.
  const base = admin.from("posts").select("*").is("parent_id", null).or(visiblePostsFilter(viewer));

  if (sort === "top") {
    let query = base.order("reaction_count", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: false });
    const c = cursor as TopCursor | null;
    if (c) {
      query = query.or(
        `reaction_count.lt.${c.reactionCount},and(reaction_count.eq.${c.reactionCount},created_at.lt.${c.createdAt}),and(reaction_count.eq.${c.reactionCount},created_at.eq.${c.createdAt},id.lt.${c.id})`
      );
    }
    const { data } = await query.limit(limit + 1);
    const rows = (data ?? []) as NoteRow[];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor<TopCursor>({ reactionCount: last.reaction_count, createdAt: last.created_at, id: last.id }) : null;
    return { page, nextCursor };
  }

  if (sort === "trending") {
    // Simplest-correct implementation per api-spec.md: recency-weighted
    // score over a recent-created candidate window, computed here rather
    // than via a DB-side ranking function. Re-ranked on every request, so
    // the cursor is "resume after this id in the freshly recomputed order,"
    // not a stable offset — acceptable drift at this scale; tune later.
    const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 86_400_000).toISOString();
    const { data } = await base.gte("created_at", since).order("created_at", { ascending: false }).limit(TRENDING_CANDIDATE_CAP);
    const ranked = ((data ?? []) as NoteRow[]).sort((a, b) => trendingScore(b) - trendingScore(a) || b.id.localeCompare(a.id));
    const c = cursor as TrendingCursor | null;
    const startIndex = c ? ranked.findIndex((r) => r.id === c.id) + 1 : 0;
    const page = ranked.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < ranked.length;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor<TrendingCursor>({ id: last.id }) : null;
    return { page, nextCursor };
  }

  // recent (default)
  let query = base.order("created_at", { ascending: false }).order("id", { ascending: false });
  const c = cursor as Keyset | null;
  if (c) query = query.or(keysetBeforeFilter(c));
  const { data } = await query.limit(limit + 1);
  const rows = (data ?? []) as NoteRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor<Keyset>({ createdAt: last.created_at, id: last.id }) : null;
  return { page, nextCursor };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sort = (url.searchParams.get("sort") as Sort | null) ?? "recent";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 100);
  const cursorParam = url.searchParams.get("cursor");
  const cursor = sort === "top" ? decodeCursor<TopCursor>(cursorParam) : sort === "trending" ? decodeCursor<TrendingCursor>(cursorParam) : decodeCursor<Keyset>(cursorParam);

  const reader = await getAuthenticatedReader(request);
  const viewer = await loadPostViewer(reader?.readerId);
  const { page, nextCursor } = await fetchPage(sort, limit, cursor, viewer);
  const items = await enrichFeedItems(page, viewer);

  return NextResponse.json({ items, nextCursor });
}

type CreateNoteBody = {
  materialId?: string;
  ranges?: AnnotationRange[];
  content?: NoteContent;
  parentId?: string;
  visibility?: "public" | "private";
  /** "discussion" — a top-level, HomeComposer-style post: no book anchor
   * required, `materialId` (when present) is an attached book rather than
   * an annotation target, and there's no `ranges` to speak of. Omitted or
   * "note" keeps every existing book-anchored-note behavior (NoteComposer,
   * reader annotation flow) exactly as it was. Ignored on a reply — a
   * reply's thread_type is always inherited from its root, never chosen
   * independently. */
  threadType?: "note" | "discussion";
  /** Posted from this group's composer (studygroup-spec.md §4.5): members
   * only. Thread roots only, like the two below. */
  groupSlug?: string;
  /** Tagged comrades: notified, and able to read it even when private. */
  mentionReaderIds?: string[];
  /** "Whole circle" (moderators of `groupSlug`): every member is notified
   * and, on a private note, can read it. */
  wholeCircle?: boolean;
};

function rangesEqual(a: AnnotationRange[], b: AnnotationRange[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((r, i) => r.passageId === b[i].passageId && r.start === b[i].start && r.end === b[i].end);
}

export async function POST(request: Request) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();

  const body = (await request.json()) as CreateNoteBody;
  if (!body.content) return validationError("content is required.", "content");
  if (body.content.kind === "voice" && !body.content.audioUrl.startsWith(cdnUrl("voice-notes/"))) {
    return validationError("audioUrl must come from POST /api/community/voice-notes.", "content");
  }
  const requestedMentions = body.parentId ? [] : (body.mentionReaderIds ?? []);
  if (!Array.isArray(requestedMentions) || requestedMentions.length > MAX_MENTIONS || requestedMentions.some((id) => typeof id !== "string")) {
    return validationError(`Tag up to ${MAX_MENTIONS} comrades.`, "mentionReaderIds");
  }
  const wholeCircle = !body.parentId && body.wholeCircle === true;
  if (wholeCircle && !body.groupSlug) return validationError("Whole circle needs a group.", "wholeCircle");

  const isReply = !!body.parentId;
  const isDiscussion = !isReply && body.threadType === "discussion";
  // Only a note on a line can go without words: that's a highlight.
  const wordless = body.content.kind === "text" && !body.content.text.trim();
  if (wordless && (isReply || isDiscussion || !body.ranges?.length)) {
    return validationError("Write something first.", "content");
  }

  if (!isReply && !isDiscussion) {
    // Book-anchored thread root — existing "note" behavior, unchanged.
    // `ranges` may be empty — a book-level note with no text anchor (see
    // NotesFeedFab's general-note composer) rather than one tied to a
    // highlight. A reply still can't invent its own anchor independent of
    // its parent: the rangesEqual check below already enforces a reply's
    // ranges exactly match its resolved thread root's (vacuously true when
    // both are empty), so a reply to a general note naturally stays
    // rangeless too.
    if (!body.materialId || !Array.isArray(body.ranges)) {
      return validationError("materialId and ranges are required.");
    }
  }
  // A reply's material comes from its resolved thread root below, never
  // from the client — see the isReply branch. A discussion post's material
  // is an optional attached book (kind: 'book_share' once resolved);
  // resolveMaterialRow's default publishedOnly still matches it, since a
  // reader upload is always `status: 'published'` regardless of its own
  // `personal`/`public` visibility (reader-uploads-spec.md § 1) — a
  // personal upload can attach to a post the same way a catalog book can.
  const material = !isReply && body.materialId ? await resolveMaterialRow(body.materialId) : null;
  if (!isReply && body.materialId && !material) return notFound();

  const group = !isReply && body.groupSlug ? await findGroup(body.groupSlug) : null;
  if (!isReply && body.groupSlug) {
    if (!group) return groupResponse("not_found");
    const access = await groupPostAccess(group.id, reader.readerId, wholeCircle);
    if (access !== "ok") return groupResponse(access);
  }

  // A note on a book with no group named (the reader, the book room) is
  // routed by the lock alone (rooms-spec §5.3): public, and also in the
  // author's group when its list has the book; locked is private, with no
  // group and no tags. A highlight is locked unless asked public.
  const route =
    !isReply && !isDiscussion && !group && material
      ? routeNote({
          locked: wordless ? body.visibility !== "public" : body.visibility === "private",
          mentionIds: requestedMentions,
          groupsWithBook: (await readerGroupsWithBook(reader.readerId, material.id)).map((g) => g.id),
        })
      : { visibility: body.visibility ?? "public", groupId: group?.id ?? null, mentionIds: requestedMentions };
  const mentionIds = route.mentionIds;

  const admin = getSupabaseAdminClient();
  let parentId: string | null = null;
  let replyingToId: string | null = null;
  let replyRecipientReaderIds: string[] = [];
  let replyRootNoteId: string | null = null;
  let materialId: string | null = material?.id ?? null;
  let ranges: AnnotationRange[] | null = isDiscussion ? null : (body.ranges ?? null);
  let threadType: "note" | "discussion" = isDiscussion ? "discussion" : "note";

  if (isReply) {
    // Mirrors stores/library-store.ts's addNote resolution exactly: whichever
    // note was actually tapped "Reply" on (root or another reply) resolves
    // to the thread's true top-level note; replyingToId is stamped only
    // when that target wasn't already the root. material/ranges/thread_type
    // are inherited from that root rather than re-trusted from the client —
    // a reply can't switch books, add an anchor its root never had, or
    // become a different thread_type than the thread it's replying into.
    const { data: target } = await admin.from("posts").select("*").eq("id", body.parentId!).maybeSingle();
    if (!target || (target.visibility !== "public" && !canReadPost(target, await loadPostViewer(reader.readerId)))) {
      return notFound();
    }
    if (!rangesEqual((target.ranges as AnnotationRange[] | null) ?? [], body.ranges ?? [])) {
      return validationError("A reply must use the same ranges as its parent thread.", "ranges");
    }
    parentId = target.parent_id ?? target.id;
    replyingToId = target.parent_id ? target.id : null;
    replyRootNoteId = parentId;
    materialId = target.material_id;
    ranges = target.ranges as AnnotationRange[] | null;
    threadType = target.thread_type;

    // Notify the immediate parent's author (the reply you tapped "Reply" on)
    // and, when that target isn't itself the thread root, the root note's
    // author too — otherwise a reply-to-a-reply never reaches the original
    // note author. Deduped since both can be the same reader.
    const recipientIds = new Set<string>([target.reader_id]);
    if (target.parent_id) {
      const { data: root } = await admin.from("posts").select("reader_id").eq("id", target.parent_id).maybeSingle();
      if (root?.reader_id) recipientIds.add(root.reader_id);
    }
    recipientIds.delete(reader.readerId); // no self-notification
    replyRecipientReaderIds = [...recipientIds];
  }

  // A post with no material can never be kind='citation' — the
  // posts_citation_requires_material check constraint forbids it — so
  // anything material-less (a book-less discussion post, or a reply into
  // one) gets 'text' instead; an attached book on a discussion thread root
  // gets 'book_share' rather than 'citation' (that's reserved for an
  // actual reader-anchored quote). Every book-anchored note/reply keeps
  // contentToColumns' own 'citation'/'voice' default, unchanged.
  const kind = isDiscussion ? (materialId ? "book_share" : "text") : materialId ? undefined : "text";

  const { data, error } = await admin
    .from("posts")
    .insert({
      reader_id: reader.readerId,
      // No topic: posts no longer carry one (spec §4.5).
      group_id: route.groupId,
      mentions_group_id: wholeCircle ? group!.id : null,
      material_id: materialId,
      parent_id: parentId,
      replying_to_id: replyingToId,
      ranges,
      thread_type: threadType,
      visibility: route.visibility,
      ...contentToColumns(body.content, kind),
    })
    .select("*")
    .single();

  if (error || !data) return validationError("Could not create note.");

  if (!isReply) {
    const mentioned = await existingReaders(mentionIds, reader.readerId);
    await savePostMentions(data.id, mentioned);
    if (mentioned.length || wholeCircle) notifyMentioned({
      id: data.id,
      text: (data.content as { text?: string }).text ?? null,
      authorId: reader.readerId,
      readerIds: mentioned,
      circle: wholeCircle ? group : null,
      groupName: group?.name ?? null,
    });
  }

  // Fire-and-forget — never let a push failure affect the create response.
  // Wrapped in try/catch so a thrown error (e.g. URL resolution) can't
  // silently swallow the whole notification for every recipient. Skipped
  // entirely for a reply into a book-less discussion thread: there's no
  // `/read/[slug]` deep link to build without a material, and no dedicated
  // discussion-post permalink exists yet to fall back to.
  if (replyRecipientReaderIds.length > 0 && materialId) {
    void (async () => {
      try {
        const [{ data: actor }, { data: replyMaterial }] = await Promise.all([
          admin.from("readers").select("pseudonym").eq("id", reader.readerId).maybeSingle(),
          admin.from("materials").select("slug, title").eq("id", materialId).maybeSingle(),
        ]);
        if (!replyMaterial) return;
        // The reply itself — /note/[id] resolves a reply to its root thread
        // and focuses it. Same url for the in-app row and the push.
        const url = `/note/${data.id}`;
        const actorName = actor?.pseudonym || "A comrade";
        // What they actually said, not an instruction to go read it — same
        // rule as the reaction notification. A voice reply has no text, so
        // it says so instead.
        const replyText = (data.content as { text?: string } | null)?.text ?? null;
        const quoted = notificationSnippet(replyText);
        const payload = {
          kind: "reply" as const,
          title: `💬 ${actorName} replied to your note`,
          body: quoted ? `“${quoted}”` : `A voice reply on ${replyMaterial.title}`,
          url,
          // The full reply text, frozen at fire time — the in-app row has
          // room for more of it than a push body does.
          actorReaderId: reader.readerId,
          snippet: replyText,
          tag: `note-reply-${replyRootNoteId}`,
        };
        await notifyReaders(replyRecipientReaderIds, payload);
      } catch (err) {
        console.error("Failed to send reply notification/push", err);
      }
    })();
  }

  const [note] = await hydrateNotes([data], reader.readerId);
  return NextResponse.json(note, { status: 201 });
}

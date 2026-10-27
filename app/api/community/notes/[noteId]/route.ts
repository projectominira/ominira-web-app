import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { forbidden, notFound, unauthorized, validationError } from "@/lib/api/errors";
import { contentToColumns, hydrateNotes, type NoteRow, type PostKind } from "@/lib/community/notes";
import { enrichFeedItems } from "@/lib/community/feed";
import { canReadPost } from "@/lib/community/visibility";
import { loadPostViewer } from "@/lib/community/viewer";
import { isModerator } from "@/lib/groups/membership";
import { readerGroupsWithBook } from "@/lib/groups/books";
import { officialReaderIds, pagePassages } from "@/lib/rooms/passage";
import { toRoomNote } from "@/lib/rooms/timeline";
import type { NoteThread } from "@/lib/rooms/types";
import type { NoteContent } from "@/lib/api/types";
import { deleteMaterialAssets } from "@/lib/materials/deleteMaterialAssets";
import type { Database } from "@/lib/supabase/database.types";

/** One thread as a room shows it (`toRoomNote` over the feed's own
 * enrichment) — so /note/[id] renders the very same NoteBubble a room does:
 * the official and moderator tags, the pin and the passage's question. A
 * note posted in a group says whether the viewer moderates it (Remove).
 *
 * Asking for a *reply* returns its root thread with `focusId` set to that
 * reply: a reply has no standalone page of its own — it's only ever read in
 * its thread — and that's what a reply notification links to.
 */
export async function GET(request: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await params;
  const reader = await getAuthenticatedReader(request);
  const admin = getSupabaseAdminClient();

  const [{ data: row }, viewer] = await Promise.all([
    admin.from("posts").select("*").eq("id", noteId).maybeSingle(),
    loadPostViewer(reader?.readerId),
  ]);
  // Same rule as every feed (lib/community/visibility.ts) — 404, not 403, so
  // existence of a private note is never leaked.
  if (!row || !canReadPost(row, viewer)) return notFound();

  let rootRow = row as NoteRow;
  if (row.parent_id) {
    const { data: parent } = await admin.from("posts").select("*").eq("id", row.parent_id).maybeSingle();
    if (!parent || !canReadPost(parent, viewer)) return notFound();
    rootRow = parent as NoteRow;
  }

  const now = Date.now();
  const groupId = rootRow.group_id;
  const [[item], officialIds, passages, moderators, group] = await Promise.all([
    enrichFeedItems([rootRow], viewer),
    officialReaderIds(),
    pagePassages([rootRow], now),
    groupId ? admin.from("group_members").select("reader_id").eq("group_id", groupId).eq("role", "moderator") : null,
    groupId ? admin.from("groups").select("pinned_post_id").eq("id", groupId).maybeSingle() : null,
  ]);
  if (!item) return notFound();

  const teamIds = new Set(moderators?.data?.map((m) => m.reader_id) ?? []);
  const note = toRoomNote(item, { now, pinnedId: group?.data?.pinned_post_id ?? null, teamIds, officialIds, passages, alsoIn: false });
  const body: NoteThread = { ...note, focusId: row.parent_id ? row.id : null, moderator: !!reader && teamIds.has(reader.readerId) };
  return NextResponse.json(body);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();

  const { noteId } = await params;
  const admin = getSupabaseAdminClient();
  const { data: existing } = await admin
    .from("posts")
    .select("reader_id, kind, material_id, group_id, parent_id, thread_type")
    .eq("id", noteId)
    .maybeSingle();
  if (!existing) return notFound();
  if (existing.reader_id !== reader.readerId) return forbidden();

  const body = (await request.json()) as { content?: NoteContent; visibility?: "public" | "private" };
  const update: Database["public"]["Tables"]["posts"]["Update"] = {};
  // Preserves whatever this row's own kind already was (citation/text/
  // book_share) rather than defaulting back to contentToColumns' own
  // 'citation' default — a book-less discussion post edited here would
  // otherwise get reset to kind='citation' with material_id still null,
  // which the posts_citation_requires_material check constraint rejects.
  if (body.content) Object.assign(update, contentToColumns(body.content, existing.kind as PostKind));
  if (body.visibility) update.visibility = body.visibility;
  // Made public, a book note with no group goes to the author's group as
  // if it had been posted public (routeNote) — so a private highlight
  // reaches the group only once it's shared publicly.
  if (body.visibility === "public" && !existing.group_id && !existing.parent_id && existing.thread_type === "note" && existing.material_id) {
    update.group_id = (await readerGroupsWithBook(reader.readerId, existing.material_id))[0]?.id ?? null;
  }

  const { data, error } = await admin.from("posts").update(update).eq("id", noteId).select("*").single();
  if (error || !data) return validationError("Could not update note.");

  const [note] = await hydrateNotes([data], reader.readerId);
  return NextResponse.json(note);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();

  const { noteId } = await params;
  const admin = getSupabaseAdminClient();
  const { data: existing } = await admin.from("posts").select("reader_id, material_id, group_id, kind").eq("id", noteId).maybeSingle();
  if (!existing) return notFound();
  // The author, or a moderator of the group it was posted in (Remove note,
  // spec §3.2 Pin).
  const ownsIt = existing.reader_id === reader.readerId;
  if (!ownsIt && !(existing.group_id && (await isModerator(existing.group_id, reader.readerId)))) return forbidden();

  // parent_id on delete cascade (models-spec.md) takes the whole reply
  // subtree with it — no manual descendant collection needed here, unlike
  // the client store's own collectWithDescendants (which existed only
  // because there was no DB to cascade for it).
  const { error } = await admin.from("posts").delete().eq("id", noteId);
  if (error) return notFound();

  // posts.material_id is `on delete set null`, so the row above never took
  // the material with it — a personal upload (reader-uploads-spec.md) that
  // was only ever attached to this one post would otherwise sit orphaned in
  // `materials` forever. Only clean it up when it's this reader's own
  // personal upload and no other post still points at it; a catalog book or
  // a material shared by another post is left untouched. Only for a post
  // that *attached* the upload (book_share) — a note or highlight on a book
  // never takes the book with it.
  if (existing.material_id && existing.kind === "book_share") {
    const { data: material } = await admin
      .from("materials")
      .select("id, slug, uploaded_by")
      .eq("id", existing.material_id)
      .maybeSingle();
    if (material && material.uploaded_by === existing.reader_id) {
      const { count } = await admin
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("material_id", material.id);
      if (!count) {
        await admin.from("pending_materials").delete().eq("material_id", material.id);
        const { error: materialDeleteError } = await admin.from("materials").delete().eq("id", material.id);
        if (!materialDeleteError) await deleteMaterialAssets(material.slug);
      }
    }
  }

  return new Response(null, { status: 204 });
}

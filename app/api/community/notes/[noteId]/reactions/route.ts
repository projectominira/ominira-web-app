import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { notFound, unauthorized } from "@/lib/api/errors";
import { notifyReader } from "@/lib/notifications/notify";
import { canReadPost } from "@/lib/community/visibility";
import { loadPostViewer } from "@/lib/community/viewer";
import { notificationSnippet } from "@/lib/notifications/snippet";

export async function POST(request: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();

  const { noteId } = await params;
  const admin = getSupabaseAdminClient();

  const { data: note } = await admin
    .from("posts")
    .select("id, reaction_count, reader_id, material_id, content, visibility, mentions_group_id")
    .eq("id", noteId)
    .maybeSingle();
  // Grants are only worth loading for a private note.
  if (!note || (note.visibility !== "public" && !canReadPost(note, await loadPostViewer(reader.readerId)))) return notFound();

  const { data: existing } = await admin
    .from("reactions")
    .select("target_id")
    .eq("target_type", "post")
    .eq("target_id", noteId)
    .eq("reader_id", reader.readerId)
    .maybeSingle();

  if (existing) {
    await admin
      .from("reactions")
      .delete()
      .eq("target_type", "post")
      .eq("target_id", noteId)
      .eq("reader_id", reader.readerId);
  } else {
    await admin.from("reactions").insert({ target_type: "post", target_id: noteId, reader_id: reader.readerId });
    // Fire-and-forget — never let a push failure affect the reaction response.
    // No self-notification when reacting to your own note.
    if (note.reader_id !== reader.readerId) {
      void (async () => {
        const [{ data: actor }, { data: material }] = await Promise.all([
          admin.from("readers").select("pseudonym").eq("id", reader.readerId).maybeSingle(),
          admin.from("materials").select("slug, title").eq("id", note.material_id!).maybeSingle(),
        ]);
        if (!material) return;
        // The reacted-to note's own page — in-app row and push share this
        // one url, and it opens the thread itself rather than loading a
        // whole book to reach one note (the page links on into the reader).
        const url = `/note/${note.id}`;
        const actorName = actor?.pseudonym || "A comrade";
        // The reacted-to note's own words — what was reacted to says far
        // more than "tap to view in <book>" ever did, on a lock screen and
        // in the feed row alike. A voice note has none, so it falls back to
        // naming the book.
        const noteText = (note.content as { text?: string } | null)?.text ?? null;
        const quoted = notificationSnippet(noteText);
        const book = material.title ?? material.slug;
        await notifyReader(note.reader_id, {
          kind: "reaction",
          title: `✊🏾 ${actorName} reacted to your note`,
          // A voice note has no words, nor does a highlight (an empty note).
          body: quoted ? `“${quoted}”` : noteText === "" ? `Your highlight in ${book}` : `Your voice note on ${book}`,
          url,
          // The full text, frozen at fire time, so the in-app row can show
          // more of it than a push body has room for.
          actorReaderId: reader.readerId,
          snippet: noteText,
          tag: `note-reaction-${noteId}`,
        });
      })();
    }
  }

  // reaction_count updates itself via the DB trigger (models-spec.md) —
  // route never touches the counter directly, just re-reads it.
  const { data: updated } = await admin.from("posts").select("reaction_count").eq("id", noteId).maybeSingle();

  return NextResponse.json({ reactedByMe: !existing, reactionCount: updated?.reaction_count ?? note.reaction_count });
}

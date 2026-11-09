import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { notifyReader } from "@/lib/notifications/notify";

const Schema = z.object({
  status: z.enum(["pending", "approved", "declined"]),
  /** The book that answers it, when marking it added — the notification links there. */
  materialId: z.string().uuid().nullish(),
});

/** Mark a reader's book request added (notifying them), declined or pending
 * again (/admin/library/suggestions). */
export async function PATCH(request: Request, { params }: { params: Promise<{ suggestionId: string }> }) {
  const { suggestionId } = await params;
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please try again." }, { status: 400 });
  const { status, materialId } = parsed.data;

  const admin = getSupabaseAdminClient();
  const { data: before } = await admin
    .from("pending_materials")
    .select("status, reader_id, title")
    .eq("id", suggestionId)
    .eq("submission_type", "suggestion")
    .maybeSingle();
  if (!before) return NextResponse.json({ error: "That request is gone." }, { status: 404 });

  const { data, error } = await admin
    .from("pending_materials")
    .update({ status, material_id: status === "approved" ? (materialId ?? null) : null })
    .eq("id", suggestionId)
    .select("id, status")
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "We could not update this request. Please try again." }, { status: 500 });

  if (status === "approved" && before.status !== "approved" && before.reader_id) {
    const { data: book } = materialId
      ? await admin.from("materials").select("slug, title").eq("id", materialId).maybeSingle()
      : { data: null };
    void notifyReader(before.reader_id, {
      kind: "book_request",
      title: book ? `“${book.title}” is in the library` : "What you asked for is in the library",
      body: `You asked: ${before.title.length > 120 ? `${before.title.slice(0, 117)}…` : before.title}`,
      url: book ? `/library/${book.slug}` : "/library",
      tag: `book-request-${suggestionId}`,
      snippet: before.title,
    }).catch(() => {});
  }

  return NextResponse.json({ item: data });
}

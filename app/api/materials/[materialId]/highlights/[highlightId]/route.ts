import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { forbidden, notFound, unauthorized, validationError } from "@/lib/api/errors";

/** The caller's own highlight, or the response that says why not. */
async function ownHighlight(request: Request, highlightId: string) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return { error: unauthorized() };
  const { data: existing } = await getSupabaseAdminClient().from("highlights").select("reader_id").eq("id", highlightId).maybeSingle();
  if (!existing) return { error: notFound() };
  if (existing.reader_id !== reader.readerId) return { error: forbidden() };
  return { error: null };
}

/** `PATCH { visibility }` — public (in the book's room) or private. */
export async function PATCH(request: Request, { params }: { params: Promise<{ materialId: string; highlightId: string }> }) {
  const { highlightId } = await params;
  const { error: denied } = await ownHighlight(request, highlightId);
  if (denied) return denied;

  const { visibility } = (await request.json()) as { visibility?: string };
  if (visibility !== "public" && visibility !== "private") return validationError("visibility must be public or private.", "visibility");

  const { error } = await getSupabaseAdminClient().from("highlights").update({ visibility }).eq("id", highlightId);
  if (error) return validationError("Could not update highlight.");
  return new Response(null, { status: 204 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ materialId: string; highlightId: string }> }) {
  const { highlightId } = await params;
  const { error: denied } = await ownHighlight(request, highlightId);
  if (denied) return denied;

  const { error } = await getSupabaseAdminClient().from("highlights").delete().eq("id", highlightId);
  if (error) return notFound();
  return new Response(null, { status: 204 });
}

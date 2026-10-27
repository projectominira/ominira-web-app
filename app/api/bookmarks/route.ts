import { NextResponse } from "next/server";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { notFound, unauthorized, validationError } from "@/lib/api/errors";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { setBookmark, toggleBookmark, type BookmarkTarget } from "@/lib/bookmarks/store";

const TARGETS: BookmarkTarget[] = ["material"];

/** Saves or unsaves a book (only books are saveable). bookmarks.target_id
 * carries no FK, so the existence check below is the only thing standing
 * between a typo'd id and a blank row on someone's Saved shelf. */
export async function POST(request: Request) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();

  const body = (await request.json()) as { targetType?: string; targetId?: string; bookmarked?: boolean };
  const targetType = body.targetType as BookmarkTarget | undefined;
  if (!targetType || !TARGETS.includes(targetType) || !body.targetId) {
    return validationError(`targetType (${TARGETS.join(" | ")}) and targetId are required.`);
  }

  const { data: target } = await getSupabaseAdminClient()
    .from("materials")
    .select("id")
    .eq("id", body.targetId)
    .maybeSingle();
  if (!target) return notFound();

  // `bookmarked` = the state the client wants (idempotent, what the app
  // sends); without it the route still toggles, for older callers.
  const bookmarked =
    typeof body.bookmarked === "boolean"
      ? await setBookmark(reader.readerId, targetType, body.targetId, body.bookmarked)
      : await toggleBookmark(reader.readerId, targetType, body.targetId);
  return NextResponse.json({ bookmarked });
}

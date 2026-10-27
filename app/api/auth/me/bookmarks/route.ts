import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized } from "@/lib/api/errors";
import { listBookmarkedIds } from "@/lib/bookmarks/store";
import { toMaterialSummary } from "@/lib/materials/summary";
import { MATERIAL_SUMMARY_COLUMNS } from "@/lib/materials/columns";

/**
 * This reader's Saved shelf (the Shelf's Bookmarks tab): their saved books
 * as `MaterialSummary[]`, what BookListRow takes. `.in(id)` loses the
 * ordering, so it's re-sorted against the bookmark ids, which already came
 * back most-recently-saved first — a Saved shelf is ordered by when *you*
 * saved something, not by when it was published or last touched.
 */
export async function GET(request: Request) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();

  const ids = await listBookmarkedIds(reader.readerId, "material");
  if (ids.length === 0) return NextResponse.json({ items: [] });

  const { data, error } = await getSupabaseAdminClient().from("materials").select(MATERIAL_SUMMARY_COLUMNS).in("id", ids);
  // Loud, not an empty shelf: the flatMap below drops any id it can't
  // hydrate, so a failed query here is indistinguishable from "you saved
  // nothing" unless it throws.
  if (error) throw new Error(`bookmarks: material hydration failed — ${error.message}`);
  const byId = new Map((data ?? []).map((m) => [m.id, m]));
  // A bookmarked material the reader can no longer see (someone else's
  // upload since made private) simply drops out — the purge trigger only
  // covers deletion, not a visibility change.
  const items = ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toMaterialSummary(row)] : [];
  });
  return NextResponse.json({ items });
}

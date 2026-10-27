import { NextResponse } from "next/server";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized } from "@/lib/api/errors";
import { listBookmarkedIds } from "@/lib/bookmarks/store";

/**
 * Just the ids of every material this reader has saved — fetched once and
 * held in one query cache, so any BookListRow anywhere in the app (Library
 * catalogue, Reading shelf, personal uploads) can render its own saved
 * state without the listing that produced it having to know who's asking.

 */
export async function GET(request: Request) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  return NextResponse.json({ materialIds: await listBookmarkedIds(reader.readerId, "material") });
}

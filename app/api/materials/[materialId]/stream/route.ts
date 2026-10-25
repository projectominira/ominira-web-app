import { NextResponse } from "next/server";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { notFound } from "@/lib/api/errors";
import { decodeCursor, type Keyset } from "@/lib/api/cursor";
import { loadPostViewer } from "@/lib/community/viewer";
import { resolveMaterialRow } from "@/lib/materials/resolve";
import { bookStreamPage, pageLimit } from "@/lib/rooms/stream";

/** `GET /api/materials/{materialId}/stream?cursor=`: the book's room
 * (rooms-spec §5.1), one page of notes and reading rooms, oldest first. */
export async function GET(request: Request, { params }: { params: Promise<{ materialId: string }> }) {
  const url = new URL(request.url);
  const [material, reader] = await Promise.all([resolveMaterialRow((await params).materialId), getAuthenticatedReader(request)]);
  if (!material) return notFound();
  const page = await bookStreamPage(material.id, await loadPostViewer(reader?.readerId), {
    cursor: decodeCursor<Keyset>(url.searchParams.get("cursor")),
    limit: pageLimit(url),
  });
  return NextResponse.json(page);
}

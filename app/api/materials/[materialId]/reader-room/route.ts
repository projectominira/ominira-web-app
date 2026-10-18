import { NextResponse } from "next/server";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { notFound } from "@/lib/api/errors";
import { noteGroup } from "@/lib/groups/books";
import { resolveBookThumbnailSrc } from "@/lib/materials/image";
import { toMaterialSummary } from "@/lib/materials/summary";
import { resolveMaterialRow } from "@/lib/materials/resolve";

/**
 * `GET /api/materials/{materialId}/reader-room` — the reader's book room
 * head (rooms-spec §2 Reader): the cover, and the group your note on the
 * book also shows in (§5.3), for the "where it goes" line. Signed out, or
 * in no group with the book, `group` is null.
 */
export async function GET(request: Request, { params }: { params: Promise<{ materialId: string }> }) {
  const { materialId } = await params;
  const [reader, material] = await Promise.all([getAuthenticatedReader(request), resolveMaterialRow(materialId)]);
  if (!material) return notFound();
  return NextResponse.json({
    // 28 × 42 in the head: the thumbnail.
    cover: resolveBookThumbnailSrc(toMaterialSummary(material)),
    group: reader ? await noteGroup(reader.readerId, material.id) : null,
  });
}

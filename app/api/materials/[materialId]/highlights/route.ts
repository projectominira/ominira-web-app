import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { notFound, unauthorized, validationError } from "@/lib/api/errors";
import { resolveMaterialRow } from "@/lib/materials/resolve";
import type { AnnotationRange, Highlight } from "@/lib/api/types";
import type { Database } from "@/lib/supabase/database.types";

type HighlightRow = Database["public"]["Tables"]["highlights"]["Row"];

function toHighlight(row: HighlightRow): Highlight {
  return {
    id: row.id,
    materialId: row.material_id,
    readerId: row.reader_id,
    ranges: row.ranges as AnnotationRange[],
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ materialId: string }> }) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();

  const { materialId } = await params;
  const material = await resolveMaterialRow(materialId);
  if (!material) return notFound();

  // The caller's own only; comrades' public ones are in the book's room.
  const { data, error } = await getSupabaseAdminClient()
    .from("highlights")
    .select("*")
    .eq("material_id", material.id)
    .eq("reader_id", reader.readerId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ items: [] });
  return NextResponse.json({ items: (data ?? []).map(toHighlight) });
}

export async function POST(request: Request, { params }: { params: Promise<{ materialId: string }> }) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();

  const { materialId } = await params;
  const material = await resolveMaterialRow(materialId);
  if (!material) return notFound();

  const body = (await request.json()) as { ranges?: AnnotationRange[] };
  if (!Array.isArray(body.ranges) || body.ranges.length === 0) {
    return validationError("ranges is required.", "ranges");
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("highlights")
    .insert({ reader_id: reader.readerId, material_id: material.id, ranges: body.ranges })
    .select("*")
    .single();

  if (error || !data) return validationError("Could not create highlight.");
  return NextResponse.json(toHighlight(data), { status: 201 });
}

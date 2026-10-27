import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import type { AnnotationRange } from "@/lib/api/types";
import { markedSegments, type Mark } from "./marks";

/** The lines comrades marked on a material, with counts and never names
 * (rooms-spec §5.4). Reads only the ranges and who, never returns who. */
export async function materialMarks(materialId: string, viewerId: string | null): Promise<Mark[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("posts")
    .select("reader_id, ranges")
    .eq("material_id", materialId)
    .is("parent_id", null);
  if (error) throw error;
  return markedSegments(
    data.map((h) => ({ readerId: h.reader_id, ranges: h.ranges as AnnotationRange[] })),
    viewerId,
  );
}

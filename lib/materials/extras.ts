import "server-only";

import type { AnnotationRange, MaterialSummary } from "@/lib/api/types";
import { toMaterialSummary } from "@/lib/materials/summary";
import { quoteText } from "@/lib/passage/types";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import type { MaterialDetail } from "./detail";

// What a book's page shows below its contents: its quotes, then related
// books — the author's other books first, then books sharing its topics.

const db = () => getSupabaseAdminClient();

const BOOK_FIELDS =
  "id, slug, material_type, title, author, description, cover_url, language, published_year, page_count_estimate, categories, thumbnail_url, google_meta_data, openlibrary_meta_data, cover_source, uploaded_by, visibility, status";
const RELATED = 12;

type BookRow = { id: string; slug: string; title: string; categories: unknown; status: string; visibility: string };

export type BookExtras = { quotes: { id: string; text: string }[]; related: MaterialSummary[] };

export async function getBookExtras(m: Pick<MaterialDetail, "id" | "authors" | "categories">): Promise<BookExtras> {
  const topics = m.categories.slice(0, 3);
  const [quoteRows, byAuthor, ...byTopic] = await Promise.all([
    db().from("passage_quotes").select("id, ranges").eq("material_id", m.id).in("status", ["listed", "used"]).order("created_at"),
    m.authors.length
      ? db().from("material_authors").select(`materials!inner(${BOOK_FIELDS}), authors!inner(slug)`).in("authors.slug", m.authors.map((a) => a.slug)).neq("material_id", m.id).limit(40)
      : { data: [], error: null },
    ...topics.map((c) =>
      db().from("materials").select(BOOK_FIELDS).contains("categories", JSON.stringify([c])).eq("status", "published").eq("visibility", "public").neq("id", m.id).limit(24)
    ),
  ]);
  for (const r of [quoteRows, byAuthor, ...byTopic]) if (r.error) throw r.error;

  const listed = (b: BookRow) => b.status === "published" && b.visibility === "public";
  const authorRows = (byAuthor.data as unknown as { materials: BookRow }[]).map((l) => l.materials).filter(listed).sort((x, y) => x.title.localeCompare(y.title));
  // Most topics in common first.
  const shared = new Map<string, { row: BookRow; n: number }>();
  for (const r of byTopic) for (const b of r.data as unknown as BookRow[]) shared.set(b.id, { row: b, n: (shared.get(b.id)?.n ?? 0) + 1 });
  const topicRows = [...shared.values()].sort((x, y) => y.n - x.n || x.row.title.localeCompare(y.row.title)).map((s) => s.row);

  const seen = new Set<string>();
  const related = [...authorRows, ...topicRows].filter((b) => !seen.has(b.id) && seen.add(b.id)).slice(0, RELATED);

  return {
    quotes: (quoteRows.data ?? []).map((q) => ({ id: q.id, text: quoteText(q.ranges as AnnotationRange[]) })),
    related: related.map((b) => toMaterialSummary(b as never)),
  };
}

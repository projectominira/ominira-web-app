import "server-only";

import MiniSearch from "minisearch";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { MATERIAL_SUMMARY_COLUMNS } from "@/lib/materials/columns";
import { applyLibraryTypeFilter } from "@/lib/materials/list";
import { toMaterialSummary } from "@/lib/materials/summary";
import type { MaterialSummary } from "@/lib/api/types";

// For you (Home): content-based. The public catalogue is indexed once
// (MiniSearch, rebuilt every few minutes); a reader's survey interests
// (category names, the catalogue's own vocabulary) and the categories and
// authors of the books they've read or picked in the survey are the query.
// Books they've started or picked are left out, and so is any book few are
// reading now. Nothing is padded in: too little signal, or too few good
// picks, and Home hides the section.

type Doc = { id: string; title: string; author: string; categories: string; description: string };

const TTL_MS = 10 * 60_000;
/** Picks shown at most. */
const SHOWN = 6;
/** Signals (interests plus books read or picked) needed before we pick. */
const MIN_SIGNAL = 2;
/** Fewer good picks than this and there's no section. */
const MIN_PICKS = 3;

let reading: { at: number; counts: Map<string, number> } | null = null;

/** How many are reading each book now (unfinished), cached like the index. */
export async function getReadingCounts(): Promise<Map<string, number>> {
  if (reading && Date.now() - reading.at < TTL_MS) return reading.counts;
  const { data, error } = await getSupabaseAdminClient().from("reader_activities").select("material_id").is("finished_at", null);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const r of data) counts.set(r.material_id, (counts.get(r.material_id) ?? 0) + 1);
  reading = { at: Date.now(), counts };
  return counts;
}

let catalogue: { at: number; index: MiniSearch<Doc>; books: Map<string, MaterialSummary> } | null = null;

export async function getCatalogue() {
  if (catalogue && Date.now() - catalogue.at < TTL_MS) return catalogue;
  const { data, error } = await applyLibraryTypeFilter(
    getSupabaseAdminClient().from("materials").select(MATERIAL_SUMMARY_COLUMNS).eq("status", "published").eq("visibility", "public")
  );
  if (error) throw error;
  const books = new Map(data.map((row) => [row.id, toMaterialSummary(row)]));
  const index = new MiniSearch<Doc>({
    fields: ["categories", "author", "title", "description"],
    searchOptions: { boost: { categories: 3, author: 2, title: 1, description: 0.5 } },
  });
  index.addAll(
    [...books.values()].map((m) => ({
      id: m.id,
      title: m.title,
      author: m.author ?? "",
      categories: m.categories.join(" "),
      description: m.googleDescription ?? m.openlibraryDescription ?? m.description ?? "",
    }))
  );
  catalogue = { at: Date.now(), index, books };
  return catalogue;
}

/** Picks only from books at least this many are reading now. */
const MIN_READERS = 3;

/** Books for the reader, best match first, and every public book's match
 * (higher is better; unlisted is no match) for ranking groups to join.
 * `books` is empty while the reader has too little signal or too few
 * picks; never a book they've started or picked in the survey, nor `skip`
 * (the book Home already shows as "Start here"), awaited last so it loads
 * alongside. */
export async function forYouBooks(readerId: string, skip: Promise<string | null>): Promise<{ books: MaterialSummary[]; scores: Map<string, number> }> {
  const admin = getSupabaseAdminClient();
  const [{ index, books }, counts, reader, activity] = await Promise.all([
    getCatalogue(),
    getReadingCounts(),
    admin.from("readers").select("interests, survey_read_material_ids").eq("id", readerId).maybeSingle(),
    admin.from("reader_activities").select("material_id").eq("reader_id", readerId),
  ]);
  if (reader.error) throw reader.error;
  if (activity.error) throw activity.error;

  const interests = (reader.data?.interests as string[] | null) ?? [];
  const seen = new Set([...((reader.data?.survey_read_material_ids as string[] | null) ?? []), ...activity.data.map((a) => a.material_id)]);
  const seeds = [...seen].flatMap((id) => books.get(id) ?? []);
  const terms = [...new Set([...interests, ...seeds.flatMap((m) => m.categories), ...seeds.flatMap((m) => (m.author ? [m.author] : []))])];
  const scores = new Map(terms.length ? index.search(terms.join(" ")).map((r) => [r.id as string, r.score]) : []);
  if (interests.length + seeds.length < MIN_SIGNAL) return { books: [], scores };

  const skipId = await skip;
  const picks = [...scores.keys()].filter((id) => id !== skipId && !seen.has(id) && (counts.get(id) ?? 0) >= MIN_READERS).slice(0, SHOWN);
  return { books: picks.length >= MIN_PICKS ? picks.flatMap((id) => books.get(id) ?? []) : [], scores };
}

import "server-only";

import { z } from "zod";
import type { AnnotationRange } from "@/lib/api/types";
import { getCategories } from "@/lib/categories/config";
import { resolveBookCoverSrc, resolveBookThumbnailSrc } from "@/lib/materials/image";
import { parseGoogleMetaData, parseOpenLibraryMetaData } from "@/lib/materials/providerMeta";
import { passageDay } from "@/lib/rooms/passage";
import { passageView } from "@/lib/rooms/homeView";
import type { HomePassage } from "@/lib/rooms/types";
import { toMaterialSummary } from "@/lib/materials/summary";
import { locateQuotes } from "@/lib/passage/sets";
import { quoteText } from "@/lib/passage/types";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { rangesKey } from "@/stores/library-store";

// The quote directory (seo-spec.md C4): quotes from every book, word for word
// from Ominira's edition. Rows live in passage_quotes with status "listed"
// (posted passages, "used", show too); migrations/20261211_seo_authors_quotes.sql.

const db = () => getSupabaseAdminClient();

/** About 10 a book keeps in-copyright books well within quotation. */
export const MAX_QUOTES_PER_BOOK = 12;

export const AddQuotesInput = z.object({
  quotes: z
    .array(
      z.object({
        book: z.string().trim().min(1).max(200).describe("A book's slug (from catalog) or id."),
        quote: z.string().trim().min(1).max(1200),
        near: z.union([z.string().max(200), z.int().positive()]).optional().describe("The block id or page number `read` showed."),
        topics: z
          .array(z.string().trim().min(2).max(40))
          .max(3)
          .default([])
          .describe("One to three library categories the quote speaks to (names from `categories`)."),
      })
    )
    .min(1)
    .max(50),
  done: z
    .array(z.string().trim().min(1).max(200))
    .max(100)
    .default([])
    .describe("Books you've finished, including ones with nothing worth quoting: marks them curated so books_to_quote moves past them. Books with a quote in this call are marked anyway."),
});
export type AddQuotesInput = z.input<typeof AddQuotesInput>;

export type AddQuotesResult = {
  added: { slug: string; title: string; added: number }[];
  skipped: { quote: string; reason: string }[];
  unknownTopics: string[];
};

/** Lists quotes in the directory at once: each is found word for word in
 * its book (as for passage sets); one already listed, or past a book's cap,
 * is skipped with a reason. */
export async function addQuotes(raw: AddQuotesInput): Promise<AddQuotesResult> {
  const input = AddQuotesInput.parse(raw);
  const [found, categories] = await Promise.all([locateQuotes(input.quotes), getCategories()]);
  const canonical = new Map(categories.map((c) => [c.toLowerCase(), c]));

  const ids = [...new Set(found.flatMap((f) => (typeof f === "string" ? [] : [f.materialId])))];
  const { data: existing, error } = ids.length
    ? await db().from("passage_quotes").select("material_id, ranges, status").in("material_id", ids).in("status", ["listed", "hidden", "used"])
    : { data: [], error: null };
  if (error) throw error;
  const seen = new Set(existing.map((e) => `${e.material_id}|${rangesKey(e.ranges as AnnotationRange[])}`));
  const count = new Map<string, number>();
  for (const e of existing) if (e.status !== "used") count.set(e.material_id, (count.get(e.material_id) ?? 0) + 1);

  const skipped: AddQuotesResult["skipped"] = [];
  const unknownTopics = new Set<string>();
  const rows: { material_id: string; ranges: AnnotationRange[]; picked_ranges: AnnotationRange[]; context: unknown; topics: string[]; status: "listed" }[] = [];
  const added = new Map<string, AddQuotesResult["added"][number]>();
  input.quotes.forEach((q, i) => {
    const f = found[i];
    if (typeof f === "string") return skipped.push({ quote: q.quote, reason: f });
    const key = `${f.materialId}|${rangesKey(f.ranges)}`;
    if (seen.has(key)) return skipped.push({ quote: q.quote, reason: "Already in the directory." });
    if ((count.get(f.materialId) ?? 0) >= MAX_QUOTES_PER_BOOK) return skipped.push({ quote: q.quote, reason: `"${f.title}" already has ${MAX_QUOTES_PER_BOOK} quotes.` });
    seen.add(key);
    count.set(f.materialId, (count.get(f.materialId) ?? 0) + 1);
    const topics = [...new Set(q.topics.flatMap((t) => {
      const name = canonical.get(t.toLowerCase());
      if (!name) unknownTopics.add(t);
      return name ? [name] : [];
    }))];
    rows.push({ material_id: f.materialId, ranges: f.ranges, picked_ranges: f.ranges, context: f.context, topics, status: "listed" });
    const a = added.get(f.materialId) ?? { slug: f.slug, title: f.title, added: 0 };
    a.added++;
    added.set(f.materialId, a);
  });

  if (rows.length) {
    const { error: insertError } = await db().from("passage_quotes").insert(rows as never);
    if (insertError) throw insertError;
  }
  // Mark curated: every book quoted here, and those the AI says it finished.
  const now = new Date().toISOString();
  const marks = [
    added.size ? db().from("materials").update({ quotes_curated_at: now }).in("id", [...added.keys()]) : null,
    input.done.length ? db().from("materials").update({ quotes_curated_at: now }).in("slug", input.done) : null,
  ];
  for (const { error: e } of await Promise.all(marks.map((m) => m ?? { error: null }))) if (e) throw e;
  return { added: [...added.values()], skipped, unknownTopics: [...unknownTopics] };
}

// ---- Reading ----------------------------------------------------------------

export const DIRECTORY_PAGE = 30;

export type DirectoryQuote = {
  id: string;
  text: string;
  book: { slug: string; title: string; author: string; cover: string | null };
  topics: string[];
};

/** A page of the directory, filtered; `more` when another page follows. */
export async function listQuotes(opts: { q?: string | null; topic?: string | null; authorId?: string | null; page?: number }): Promise<{ quotes: DirectoryQuote[]; more: boolean }> {
  const page = Math.max(1, opts.page ?? 1);
  const { data, error } = await db().rpc("directory_quotes", {
    q: opts.q?.trim() || null,
    topic: opts.topic ?? null,
    author: opts.authorId ?? null,
    lim: DIRECTORY_PAGE + 1,
    off: (page - 1) * DIRECTORY_PAGE,
  });
  if (error) throw error;
  const rows = data.slice(0, DIRECTORY_PAGE);
  return { quotes: await toDirectoryQuotes(rows), more: data.length > DIRECTORY_PAGE };
}

/** Quote rows with their book, as the directory, author and topic pages show them. */
export async function toDirectoryQuotes(rows: { id: string; material_id: string; ranges: unknown; topics: string[] }[]): Promise<DirectoryQuote[]> {
  if (rows.length === 0) return [];
  const { data: books, error } = await db()
    .from("materials")
    .select("id, slug, material_type, title, author, description, cover_url, language, published_year, page_count_estimate, categories, thumbnail_url, google_meta_data, openlibrary_meta_data, cover_source, uploaded_by, visibility")
    .in("id", [...new Set(rows.map((r) => r.material_id))]);
  if (error) throw error;
  const byId = new Map(books.map((b) => [b.id, b]));
  return rows.flatMap((r) => {
    const b = byId.get(r.material_id);
    if (!b) return [];
    return [{ id: r.id, text: quoteText(r.ranges as AnnotationRange[]), topics: r.topics, book: { slug: b.slug, title: b.title, author: b.author, cover: resolveBookThumbnailSrc(toMaterialSummary(b)) } }];
  });
}

/** Authors (by name) and topics (in the library's order) that have quotes:
 * the directory's chips, and its sitemap entries. */
export async function quoteFacets(): Promise<{ authors: { slug: string; name: string; quotes: number }[]; topics: string[] }> {
  const [categories, { data, error }] = await Promise.all([getCategories(), db().rpc("directory_facets")]);
  if (error) throw error;
  const authors = data.flatMap((f) => (f.kind === "author" && f.slug ? [{ slug: f.slug, name: f.name, quotes: f.quotes }] : [])).sort((x, y) => x.name.localeCompare(y.name));
  const used = new Set(data.filter((f) => f.kind === "topic").map((f) => f.name));
  return { authors, topics: categories.filter((c) => used.has(c)) };
}

/** Public, quotable books (EPUB or PDF) not yet curated, oldest first, for
 * the connector's books_to_quote. */
export async function booksToQuote({ offset, limit }: { offset: number; limit: number }) {
  const { data, error, count } = await db()
    .from("materials")
    .select("slug, title, author, material_type, categories", { count: "exact" })
    .eq("status", "published")
    .eq("visibility", "public")
    .in("material_type", ["book", "pdf"])
    .is("quotes_curated_at", null)
    .order("created_at")
    .order("id")
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return {
    total: count ?? data.length,
    books: data.map((b) => ({ slug: b.slug, title: b.title, author: b.author, categories: (b.categories as string[] | null) ?? [] })),
    next: offset + limit < (count ?? 0) ? offset + limit : null,
  };
}

/** Today's passage of the day with its book's cover: the directory's featured card. */
export async function todayQuote(): Promise<(HomePassage & { cover: string | null; slug: string | null }) | null> {
  const day = passageDay(Date.now());
  const { data, error } = await db().from("daily_passages").select("post_id").eq("day", day).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: post, error: postError } = await db().from("posts").select("material_id").eq("id", data.post_id).maybeSingle();
  if (postError) throw postError;
  const materialId = post?.material_id;
  const [passage, book] = await Promise.all([
    passageView(data.post_id, day, null),
    materialId ? db().from("materials").select("slug, cover_url, thumbnail_url, google_meta_data, openlibrary_meta_data, cover_source").eq("id", materialId).maybeSingle() : null,
  ]);
  if (!passage) return null;
  const b = book?.data;
  const cover = b
    ? resolveBookCoverSrc({
        cover: b.cover_url,
        thumbnail: b.thumbnail_url,
        googleCoverUrl: parseGoogleMetaData(b.google_meta_data).coverUrl,
        googleThumbnailUrl: parseGoogleMetaData(b.google_meta_data).thumbnailUrl,
        openlibraryCoverUrl: parseOpenLibraryMetaData(b.openlibrary_meta_data).coverUrl,
        openlibraryThumbnailUrl: parseOpenLibraryMetaData(b.openlibrary_meta_data).thumbnailUrl,
        coverSource: b.cover_source,
      })
    : null;
  return { ...passage, cover, slug: b?.slug ?? null };
}

// ---- Admin --------------------------------------------------------------------

export const ADMIN_PAGE = 50;

export type AdminQuote = DirectoryQuote & { hidden: boolean };

/** Directory quotes for /admin/quotes: listed or hidden, newest first, by
 * their words. Posted passages ("used") stay out: they belong to the calendar. */
export async function adminQuotes(opts: { q: string; hidden: boolean; page: number }): Promise<{ quotes: AdminQuote[]; more: boolean; total: number }> {
  let query = db()
    .from("passage_quotes")
    .select("id, material_id, ranges, topics, status", { count: "exact" })
    .eq("status", opts.hidden ? "hidden" : "listed");
  if (opts.q) query = query.textSearch("search_vector", opts.q, { type: "websearch", config: "english" });
  const from = (opts.page - 1) * ADMIN_PAGE;
  const { data, error, count } = await query.order("created_at", { ascending: false }).order("id").range(from, from + ADMIN_PAGE);
  if (error) throw error;
  const quotes = await toDirectoryQuotes(data.slice(0, ADMIN_PAGE));
  return { quotes: quotes.map((q) => ({ ...q, hidden: opts.hidden })), more: data.length > ADMIN_PAGE, total: count ?? data.length };
}

/** Hides a directory quote, or lists it again. False when there's no such quote. */
export async function setQuoteHidden(id: string, hidden: boolean): Promise<boolean> {
  const { data, error } = await db()
    .from("passage_quotes")
    .update({ status: hidden ? "hidden" : "listed" })
    .eq("id", id)
    .in("status", ["listed", "hidden"])
    .select("id");
  if (error) throw error;
  return data.length > 0;
}

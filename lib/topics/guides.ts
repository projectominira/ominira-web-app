import "server-only";

import { z } from "zod";
import type { MaterialSummary } from "@/lib/api/types";
import { getCategories } from "@/lib/categories/config";
import { slugifyCategory } from "@/lib/categories/slug";
import { toMaterialSummary } from "@/lib/materials/summary";
import { resolveBookThumbnailSrc } from "@/lib/materials/image";
import { toDirectoryQuotes, type DirectoryQuote } from "@/lib/quotes/directory";
import { listCurrentReaders } from "@/lib/reader/activity";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { allRows } from "@/lib/supabase/allRows";

// Topic pages (seo-spec.md C3): /topics/<slug>, a curated guide to a broad
// topic or a library category. The connector writes the guide (write_topic)
// and it goes live at once, like quotes; editors can edit or remove it in
// /admin/topics. Every category has a page from the start (its books); a broad
// topic once it has a guide.
// migrations/20261214_topic_guides.sql.

const db = () => getSupabaseAdminClient();

const BOOK_FIELDS =
  "id, slug, material_type, title, author, description, cover_url, language, published_year, page_count_estimate, categories, thumbnail_url, google_meta_data, openlibrary_meta_data, cover_source, uploaded_by, visibility, status";

type BookRow = { id: string; slug: string; title: string; author: string; categories: unknown };
type StoredStage = { title: string; intro: string; books: { slug: string; why: string }[] };

/** A category page with fewer books is too thin to index before its guide. */
const MIN_CATEGORY_BOOKS = 3;
/** "All N books" rows shown before "Show all"; the rest are in the HTML too. */
export const ALL_SHOWN = 24;

const stagesOf = (json: unknown) => (Array.isArray(json) ? (json as StoredStage[]) : []);

// ---- Drafting (connector) ---------------------------------------------------

const Stage = z.object({
  title: z.string().trim().min(2).max(60).describe('Plain: "Start here", "Go deeper", "The arguments", or the stage\'s own subject.'),
  intro: z.string().trim().min(10).max(300).describe("One or two sentences on what this stage covers and why it comes here."),
  books: z
    .array(
      z.object({
        book: z.string().trim().min(1).max(200).describe("A public book's slug, from catalog."),
        why: z.string().trim().min(40).max(400).describe("One or two sentences specific to this book: its argument, a scene, a fact, who it suits."),
      })
    )
    .min(1)
    .max(10),
});

export const WriteTopicInput = z.object({
  name: z.string().trim().min(2).max(80).describe('The topic: "The Haitian Revolution", or a category name exactly as `categories` gives it.'),
  category: z.boolean().default(false).describe("True when this guide is for the library category of that name."),
  title: z.string().trim().min(5).max(120).describe('What people search for: "Books on the Haitian Revolution", "Where to start with Pan-Africanism". No colons, no "Ultimate Guide".'),
  intro: z
    .string()
    .trim()
    .min(600)
    .max(2400)
    .describe("150–300 words, answer first: what the topic is and why it matters, then how the reading path runs. Paragraphs separated by a blank line."),
  stages: z.array(Stage).min(1).max(4).describe("The reading path, in order: about 20 books in all (6–24), none twice."),
});
export type WriteTopicInput = z.input<typeof WriteTopicInput>;

/** Saves and publishes the connector's topic guide. A string is a problem for the AI to fix. */
export async function writeTopic(raw: WriteTopicInput): Promise<{ slug: string; name: string } | string> {
  const input = WriteTopicInput.parse(raw);
  let category: string | null = null;
  if (input.category) {
    category = (await getCategories()).find((c) => c.toLowerCase() === input.name.toLowerCase()) ?? null;
    if (!category) return `No category "${input.name}". Use a name from categories, or category: false for a broad topic.`;
  }
  const name = category ?? input.name;
  const slug = slugifyCategory(name);
  if (!slug) return "The name needs letters or numbers.";

  const picks = input.stages.flatMap((s) => s.books.map((b) => b.book));
  const unique = [...new Set(picks)];
  if (unique.length !== picks.length) return "A book appears twice. Put each book in one stage only.";
  if (unique.length < 6 || unique.length > 24) return `The path has ${unique.length} books; give 6–24 (about 20).`;
  const { data: books, error } = await db().from("materials").select("slug").in("slug", unique).eq("status", "published").eq("visibility", "public");
  if (error) throw error;
  const found = new Set(books.map((b) => b.slug));
  const missing = unique.filter((s) => !found.has(s));
  if (missing.length) return `Not public books: ${missing.join(", ")}. Use slugs from catalog.`;

  // One guide per topic: a category's by its name, a broad topic's by slug.
  const { data: existing, error: findError } = await db()
    .from("topic_guides")
    .select("id, slug, category")
    .or(category ? `category.eq."${category.replace(/"/g, '\\"')}",slug.eq.${slug}` : `slug.eq.${slug}`);
  if (findError) throw findError;
  const mine = existing.find((g) => (category ? g.category === category : g.slug === slug));
  if (existing.some((g) => g !== mine && g.slug === slug)) return `"${name}" is taken by another guide${category ? "" : " (a category's): pass category: true"}.`;

  const now = new Date().toISOString();
  const fields = {
    name,
    category,
    title: input.title,
    intro: input.intro,
    stages: input.stages.map((s) => ({ title: s.title, intro: s.intro, books: s.books.map((b) => ({ slug: b.book, why: b.why })) })),
    status: "approved" as const,
    approved_at: now,
    updated_at: now,
  };
  const { error: saveError } = mine
    ? await db().from("topic_guides").update(fields).eq("id", mine.id)
    : await db().from("topic_guides").insert({ ...fields, slug });
  if (saveError) throw saveError;
  return { slug: mine?.slug ?? slug, name };
}

/** Every category with its book count and whether it has a guide, then the
 * broad topics already written: what to write next. */
export async function topicsToWrite() {
  const [categories, guides, rows] = await Promise.all([
    getCategories(),
    db().from("topic_guides").select("slug, name, category, updated_at").eq("status", "approved"),
    allRows((from, to) => db().from("materials").select("id, categories").eq("status", "published").eq("visibility", "public").order("id").range(from, to)),
  ]);
  if (guides.error) throw guides.error;
  const counts = new Map<string, number>();
  for (const r of rows) for (const c of (r.categories as string[] | null) ?? []) counts.set(c, (counts.get(c) ?? 0) + 1);
  const byCategory = new Map(guides.data.filter((g) => g.category).map((g) => [g.category!, g]));
  return {
    categories: categories.map((c) => ({ name: c, books: counts.get(c) ?? 0, guide: byCategory.has(c) })),
    broad_topics: guides.data.filter((g) => !g.category).map((g) => ({ name: g.name, slug: g.slug, updated: g.updated_at.slice(0, 10) })),
    note: "Write a guide for each category with guide: false (most books first), and for broad topics the editor names or the brief suggests. Guides go live at once. Rewrite an existing guide only when the editor asks: sending again replaces it.",
  };
}

// ---- Reading ----------------------------------------------------------------

export type TopicStage = { title: string; intro: string; books: { book: MaterialSummary; why: string }[]; quote: DirectoryQuote | null };

export type TopicPage = {
  slug: string;
  name: string;
  title: string;
  /** Empty until a guide is approved. */
  intro: string;
  category: string | null;
  stages: TopicStage[];
  /** A category's every book, A to Z; empty for a broad topic. */
  all: MaterialSummary[];
  authors: { slug: string; name: string }[];
  related: { slug: string; name: string }[];
  approvedAt: string | null;
  indexable: boolean;
};

type Guide = { id: string; slug: string; name: string; category: string | null; title: string; intro: string; stages: unknown; status: string; approved_at: string | null };

/** The guide or category a slug names: the guide's own slug first, then a
 * category's (a renamed category keeps its guide). Null: no such topic. */
async function resolve(slug: string): Promise<{ guide: Guide | null; category: string | null } | null> {
  const [{ data: bySlug, error }, categories] = await Promise.all([
    db().from("topic_guides").select("*").eq("slug", slug).maybeSingle(),
    getCategories(),
  ]);
  if (error) throw error;
  if (bySlug) return { guide: bySlug, category: bySlug.category };
  const category = categories.find((c) => slugifyCategory(c) === slug);
  if (!category) return null;
  const { data: guide, error: e } = await db().from("topic_guides").select("*").eq("category", category).maybeSingle();
  if (e) throw e;
  return { guide, category };
}

/** Everything a topic page shows, or null when there's no page. */
export async function getTopicPage(slug: string): Promise<TopicPage | null> {
  const r = await resolve(slug);
  if (!r) return null;
  const guide = r.guide?.status === "approved" ? r.guide : null;
  if (!guide && !r.category) return null;

  const stored = guide ? stagesOf(guide.stages) : [];
  const picked = stored.flatMap((s) => s.books.map((b) => b.slug));
  const [curated, inCategory, approved] = await Promise.all([
    picked.length
      ? db().from("materials").select(BOOK_FIELDS).in("slug", picked).eq("status", "published").eq("visibility", "public")
      : { data: [], error: null },
    r.category
      ? allRows((from, to) =>
          db().from("materials").select(BOOK_FIELDS).contains("categories", JSON.stringify([r.category])).eq("status", "published").eq("visibility", "public").order("id").range(from, to)
        )
      : Promise.resolve([]),
    db().from("topic_guides").select("slug, name, category, stages").eq("status", "approved"),
  ]);
  if (curated.error) throw curated.error;
  if (approved.error) throw approved.error;
  const curatedRows = curated.data as unknown as BookRow[];
  const allRowsSorted = (inCategory as unknown as BookRow[]).sort((x, y) => x.title.localeCompare(y.title));
  if (!guide && allRowsSorted.length === 0) return null;

  const bySlug = new Map(curatedRows.map((b) => [b.slug, b]));
  const pathIds = picked.flatMap((s) => (bySlug.has(s) ? [bySlug.get(s)!.id] : []));
  const pageRows = [...curatedRows, ...allRowsSorted];
  const [readers, quoteRows, authorLinks] = await Promise.all([
    listCurrentReaders([...new Set(pageRows.map((b) => b.id))]),
    pathIds.length
      ? db().from("passage_quotes").select("id, material_id, ranges, topics").in("material_id", pathIds).in("status", ["listed", "used"])
      : { data: [], error: null },
    db()
      .from("material_authors")
      .select("material_id, authors!inner(slug, name)")
      .in("material_id", (pathIds.length ? pathIds : allRowsSorted.map((b) => b.id)).slice(0, 300)),
  ]);
  if (quoteRows.error) throw quoteRows.error;
  if (authorLinks.error) throw authorLinks.error;

  const withReaders = (b: BookRow): MaterialSummary => {
    const rd = readers.get(b.id);
    return { ...toMaterialSummary(b as never), currentReaders: rd?.readers ?? [], currentReaderCount: rd?.totalCount ?? 0 };
  };

  // One quote woven into each stage, from its own books: the shortest, and
  // never two from the same book.
  const quotes = await toDirectoryQuotes(quoteRows.data);
  const quotedBooks = new Set<string>();
  const stages: TopicStage[] = stored.map((s) => {
    const books = s.books.flatMap((b) => {
      const row = bySlug.get(b.slug);
      return row ? [{ book: withReaders(row), why: b.why }] : [];
    });
    const slugs = new Set(books.map((b) => b.book.slug));
    const quote =
      quotes
        .filter((q) => slugs.has(q.book.slug) && !quotedBooks.has(q.book.slug) && q.text.length <= 320)
        .sort((x, y) => x.text.length - y.text.length)[0] ?? null;
    if (quote) quotedBooks.add(quote.book.slug);
    return { title: s.title, intro: s.intro, books, quote };
  });

  // Authors: who wrote the path's books (or the category's), most books first.
  const authorCount = new Map<string, { slug: string; name: string; n: number }>();
  for (const l of authorLinks.data as unknown as { authors: { slug: string; name: string } }[]) {
    const a = authorCount.get(l.authors.slug) ?? { ...l.authors, n: 0 };
    a.n++;
    authorCount.set(a.slug, a);
  }
  const authors = [...authorCount.values()].sort((x, y) => y.n - x.n || x.name.localeCompare(y.name)).slice(0, 6).map(({ slug: s, name }) => ({ slug: s, name }));

  // Related: approved guides sharing books, then the categories the page's books carry.
  const self = guide?.slug ?? slug;
  const pageSlugs = new Set(pageRows.map((b) => b.slug));
  const guides = approved.data
    .filter((g) => g.slug !== self && (!r.category || g.category !== r.category))
    .map((g) => ({ slug: g.slug, name: g.name, shared: stagesOf(g.stages).flatMap((s) => s.books).filter((b) => pageSlugs.has(b.slug)).length }))
    .filter((g) => g.shared > 0)
    .sort((x, y) => y.shared - x.shared);
  const catCount = new Map<string, number>();
  for (const b of pageRows) for (const c of (b.categories as string[] | null) ?? []) if (c !== r.category) catCount.set(c, (catCount.get(c) ?? 0) + 1);
  const cats = [...catCount.entries()].sort((x, y) => y[1] - x[1]).map(([c]) => ({ slug: slugifyCategory(c), name: c }));
  const related = [...guides, ...cats].filter((t, i, list) => list.findIndex((u) => u.slug === t.slug) === i).slice(0, 5).map(({ slug: s, name }) => ({ slug: s, name }));

  const name = guide?.name ?? r.category!;
  return {
    slug: self,
    name,
    title: guide?.title ?? `Books on ${name}`,
    intro: guide?.intro ?? "",
    category: r.category,
    stages,
    all: allRowsSorted.map(withReaders),
    authors,
    related,
    approvedAt: guide?.approved_at ?? null,
    indexable: !!guide || allRowsSorted.length >= MIN_CATEGORY_BOOKS,
  };
}

/** A few covers for a link to a topic page: its path's first books, or its category's. */
export async function topicCovers(slug: string, n = 4): Promise<string[]> {
  const r = await resolve(slug);
  if (!r) return [];
  const path = r.guide?.status === "approved" ? stagesOf(r.guide.stages).flatMap((s) => s.books.map((b) => b.slug)).slice(0, n) : [];
  let query = db().from("materials").select(BOOK_FIELDS).eq("status", "published").eq("visibility", "public");
  query = path.length ? query.in("slug", path) : r.category ? query.contains("categories", JSON.stringify([r.category])).order("title") : query.limit(0);
  const { data, error } = await query.limit(n);
  if (error) throw error;
  const rows = (data as unknown as BookRow[]).sort((x, y) => path.indexOf(x.slug) - path.indexOf(y.slug));
  return rows.flatMap((b) => resolveBookThumbnailSrc(toMaterialSummary(b as never)) ?? []);
}

export type ListedTopic = { slug: string; name: string; title: string; books: number; guide: boolean };

/** Every topic page worth listing: guides first (A to Z), then the
 * categories without one. The /topics hub, the sitemap and llms.txt. */
export async function listTopics(): Promise<ListedTopic[]> {
  const [categories, guides, rows] = await Promise.all([
    getCategories(),
    db().from("topic_guides").select("slug, name, category, title, stages").eq("status", "approved"),
    allRows((from, to) => db().from("materials").select("id, categories").eq("status", "published").eq("visibility", "public").order("id").range(from, to)),
  ]);
  if (guides.error) throw guides.error;
  const counts = new Map<string, number>();
  for (const r of rows) for (const c of (r.categories as string[] | null) ?? []) counts.set(c, (counts.get(c) ?? 0) + 1);
  const guided = guides.data.map((g) => ({
    slug: g.slug,
    name: g.name,
    title: g.title,
    books: g.category ? (counts.get(g.category) ?? 0) : stagesOf(g.stages).reduce((n, s) => n + s.books.length, 0),
    guide: true,
  }));
  const withGuide = new Set(guides.data.flatMap((g) => (g.category ? [g.category] : [])));
  const plain = categories
    .filter((c) => !withGuide.has(c) && (counts.get(c) ?? 0) >= MIN_CATEGORY_BOOKS)
    .map((c) => ({ slug: slugifyCategory(c), name: c, title: `Books on ${c}`, books: counts.get(c) ?? 0, guide: false }));
  return [...guided.sort((x, y) => x.name.localeCompare(y.name)), ...plain];
}

// ---- Admin ------------------------------------------------------------------

export type AdminTopic = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  title: string;
  intro: string;
  stages: { title: string; intro: string; books: { slug: string; title: string; why: string }[] }[];
  updatedAt: string;
};

/** Published guides, newest change first, with book titles. */
export async function adminTopics(): Promise<AdminTopic[]> {
  const { data, error } = await db().from("topic_guides").select("*").eq("status", "approved").order("updated_at", { ascending: false }).limit(200);
  if (error) throw error;
  const slugs = [...new Set(data.flatMap((g) => stagesOf(g.stages).flatMap((s) => s.books.map((b) => b.slug))))];
  const titles = new Map<string, string>();
  for (let i = 0; i < slugs.length; i += 300) {
    const { data: books, error: e } = await db().from("materials").select("slug, title").in("slug", slugs.slice(i, i + 300));
    if (e) throw e;
    for (const b of books) titles.set(b.slug, b.title);
  }
  return data.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    category: g.category,
    title: g.title,
    intro: g.intro,
    stages: stagesOf(g.stages).map((s) => ({ ...s, books: s.books.map((b) => ({ ...b, title: titles.get(b.slug) ?? `${b.slug} (gone)` })) })),
    updatedAt: g.updated_at,
  }));
}

export const TopicEdit = z.object({
  title: z.string().trim().min(5).max(120).optional(),
  intro: z.string().trim().max(3000).optional(),
  /** The same stages and books, with their words edited. */
  stages: z
    .array(z.object({ title: z.string().trim().min(1).max(60), intro: z.string().trim().max(300), books: z.array(z.object({ slug: z.string(), why: z.string().trim().max(400) })).max(10) }))
    .max(4)
    .optional(),
});

/** An editor's edit. False when there's no such guide. */
export async function editTopic(id: string, edit: z.infer<typeof TopicEdit>): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("topic_guides").update({ ...edit, approved_at: now, updated_at: now }).eq("id", id).select("id");
  if (error) throw error;
  return data.length > 0;
}

/** Takes a guide off the site for good. False when there's no such guide. */
export async function removeTopic(id: string): Promise<boolean> {
  const { data, error } = await db().from("topic_guides").delete().eq("id", id).select("id");
  if (error) throw error;
  return data.length > 0;
}

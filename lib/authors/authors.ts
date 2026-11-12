import "server-only";

import { z } from "zod";
import type { MaterialSummary } from "@/lib/api/types";
import { toMaterialSummary } from "@/lib/materials/summary";
import { listCurrentReaders } from "@/lib/reader/activity";
import { toDirectoryQuotes, type DirectoryQuote } from "@/lib/quotes/directory";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import type { AuthorBioStatus } from "@/lib/supabase/database.types";

// Author pages (seo-spec.md C2): /authors/<slug>. The connector drafts the
// bio, facts and "read alongside" (write_author); an editor approves them in
// /admin/authors. Books and quotes show from the start.
// migrations/20261211_seo_authors_quotes.sql, 20261212_author_pages.sql.

const db = () => getSupabaseAdminClient();

/** Quotes on the page; the rest are a link away on /quotes/<slug>. */
const PAGE_QUOTES = 5;

/** Worth indexing: an approved bio, or enough books or quotes to be more
 * than a single book's page. The rest are noindex, follow and out of the sitemap. */
export const isIndexable = (a: { bio_status: AuthorBioStatus; books: number; quotes: number }) => a.bio_status === "approved" || a.books >= 2 || a.quotes >= 3;

// ---- Drafting (connector) ---------------------------------------------------

const Source = z.object({ title: z.string().trim().min(1).max(80), url: z.url().max(500) });
const Year = z.int().min(-3000).max(2100);

export const WriteAuthorInput = z.object({
  author: z.string().trim().min(1).max(120).describe("The author's slug, from authors_to_write."),
  bio: z
    .string()
    .trim()
    .min(200)
    .max(1500)
    .describe("80–150 words in your own words, from facts you checked; never copied. Answer first: who they were and why they matter, then the life."),
  sources: z.array(Source).min(1).max(5).describe("Where each fact was checked (Wikipedia, Wikidata, a reliable biography)."),
  born: Year.nullable().default(null).describe("Year of birth, if certain."),
  died: Year.nullable().default(null).describe("Year of death; null if living or unknown."),
  role: z.string().trim().max(120).default("").describe('What they were, plainly: "Psychiatrist, writer and revolutionary".'),
  places: z.string().trim().max(120).default("").describe('The countries of their life and work: "Martinique, France, Algeria".'),
  wikidata_id: z
    .string()
    .regex(/^Q\d+$/)
    .nullable()
    .default(null)
    .describe("Their Wikidata item (Q…), when you're sure it's this person."),
  alongside: z
    .array(z.object({ book: z.string().trim().min(1).max(200).describe("A book's slug, by another author."), why: z.string().trim().min(20).max(240) }))
    .max(4)
    .default([])
    .describe("Up to 4 books by other authors in the library to read alongside theirs, each with one specific sentence on the link."),
});
export type WriteAuthorInput = z.input<typeof WriteAuthorInput>;

/** Saves the connector's draft of an author page for an editor to approve. */
export async function writeAuthor(raw: WriteAuthorInput): Promise<{ slug: string; name: string } | string> {
  const input = WriteAuthorInput.parse(raw);
  const { data: author, error } = await db().from("authors").select("id, slug, name").eq("slug", input.author).maybeSingle();
  if (error) throw error;
  if (!author) return `No author "${input.author}". Use a slug from authors_to_write.`;

  // "Read alongside": public books, none of them theirs.
  const slugs = [...new Set(input.alongside.map((a) => a.book))];
  if (slugs.length) {
    const [books, own] = await Promise.all([
      db().from("materials").select("id, slug").in("slug", slugs).eq("status", "published").eq("visibility", "public"),
      db().from("material_authors").select("material_id").eq("author_id", author.id),
    ]);
    if (books.error) throw books.error;
    if (own.error) throw own.error;
    const theirs = new Set(own.data.map((o) => o.material_id));
    const found = new Map(books.data.map((b) => [b.slug, b.id]));
    const bad = slugs.filter((s) => !found.has(s) || theirs.has(found.get(s)!));
    if (bad.length) return `Not public books by another author: ${bad.join(", ")}. Use slugs from catalog.`;
  }

  const { error: saveError } = await db()
    .from("authors")
    .update({
      bio: input.bio,
      bio_sources: input.sources,
      born: input.born,
      died: input.died,
      role: input.role,
      places: input.places,
      wikidata_id: input.wikidata_id,
      alongside: input.alongside.map((a) => ({ slug: a.book, why: a.why })),
      bio_status: "draft",
      approved_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", author.id);
  if (saveError) throw saveError;
  return { slug: author.slug, name: author.name };
}

/** Authors with public books and no page drafted yet, most books first. */
export async function authorsToWrite({ offset, limit, redo }: { offset: number; limit: number; redo: boolean }) {
  const { data, error } = await db().rpc("author_stats");
  if (error) throw error;
  const todo = data
    .filter((a) => (redo ? a.bio_status !== "none" : a.bio_status === "none"))
    .sort((x, y) => y.books - x.books || y.quotes - x.quotes || x.name.localeCompare(y.name));
  const page = todo.slice(offset, offset + limit);
  const { data: links, error: linkError } = page.length
    ? await db().from("material_authors").select("author_id, materials!inner(slug, title, status, visibility)").in("author_id", page.map((a) => a.id))
    : { data: [], error: null };
  if (linkError) throw linkError;
  const books = new Map<string, string[]>();
  for (const l of links as unknown as { author_id: string; materials: { title: string; status: string; visibility: string } }[]) {
    if (l.materials.status === "published" && l.materials.visibility === "public") books.set(l.author_id, [...(books.get(l.author_id) ?? []), l.materials.title]);
  }
  return {
    total: todo.length,
    authors: page.map((a) => ({ slug: a.slug, name: a.name, status: a.bio_status, books: books.get(a.id) ?? [], quotes: a.quotes })),
    next: offset + limit < todo.length ? offset + limit : null,
  };
}

// ---- Reading ----------------------------------------------------------------

export type AuthorPage = {
  slug: string;
  name: string;
  /** Approved only; empty otherwise. */
  bio: string;
  sources: { title: string; url: string }[];
  born: number | null;
  died: number | null;
  role: string;
  places: string;
  wikidataId: string | null;
  approvedAt: string | null;
  /** As the library lists them, with who is reading each. */
  books: MaterialSummary[];
  quotes: DirectoryQuote[];
  moreQuotes: boolean;
  alongside: { book: MaterialSummary; why: string }[];
  topics: string[];
  indexable: boolean;
};

const BOOK_FIELDS =
  "id, slug, material_type, title, author, description, cover_url, language, published_year, page_count_estimate, categories, thumbnail_url, google_meta_data, openlibrary_meta_data, cover_source, uploaded_by, visibility, status";

type BookRow = { id: string; slug: string; title: string; author: string; categories: unknown; status: string; visibility: string };

const toBook = (b: BookRow): MaterialSummary => toMaterialSummary(b as never);

/** Everything an author page shows, or null when there's no such author
 * with a public book. */
export async function getAuthorPage(slug: string): Promise<AuthorPage | null> {
  const { data: a, error } = await db().from("authors").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!a) return null;
  const approved = a.bio_status === "approved";
  const alongsideRefs = approved ? ((a.alongside as { slug: string; why: string }[] | null) ?? []) : [];

  const [links, quoteRows, alongsideRows] = await Promise.all([
    db().from("material_authors").select(`materials!inner(${BOOK_FIELDS})`).eq("author_id", a.id),
    db().rpc("directory_quotes", { author: a.id, lim: PAGE_QUOTES + 1, off: 0 }),
    alongsideRefs.length
      ? db().from("materials").select(BOOK_FIELDS).in("slug", alongsideRefs.map((r) => r.slug)).eq("status", "published").eq("visibility", "public")
      : { data: [], error: null },
  ]);
  if (links.error) throw links.error;
  if (quoteRows.error) throw quoteRows.error;
  if (alongsideRows.error) throw alongsideRows.error;

  const rows = (links.data as unknown as { materials: BookRow }[])
    .map((l) => l.materials)
    .filter((b) => b.status === "published" && b.visibility === "public")
    // A to Z, as the library lists them (published_year is often an edition's).
    .sort((x, y) => x.title.localeCompare(y.title));
  if (rows.length === 0) return null;

  const alongsideBooks = alongsideRows.data as unknown as BookRow[];
  const [quotes, readers] = await Promise.all([
    toDirectoryQuotes(quoteRows.data.slice(0, PAGE_QUOTES)),
    listCurrentReaders([...rows, ...alongsideBooks].map((b) => b.id)),
  ]);
  // The library's "N currently reading" on each row.
  const withReaders = (b: BookRow): MaterialSummary => {
    const r = readers.get(b.id);
    return { ...toBook(b), currentReaders: r?.readers ?? [], currentReaderCount: r?.totalCount ?? 0 };
  };
  const bySlug = new Map(alongsideBooks.map((b) => [b.slug, b]));
  const topicCount = new Map<string, number>();
  for (const b of rows) for (const c of (b.categories as string[] | null) ?? []) topicCount.set(c, (topicCount.get(c) ?? 0) + 1);

  return {
    slug: a.slug,
    name: a.name,
    bio: approved ? a.bio : "",
    sources: approved ? ((a.bio_sources as { title: string; url: string }[] | null) ?? []) : [],
    born: approved ? a.born : null,
    died: approved ? a.died : null,
    role: approved ? a.role : "",
    places: approved ? a.places : "",
    wikidataId: approved ? a.wikidata_id : null,
    approvedAt: a.approved_at,
    books: rows.map(withReaders),
    quotes,
    moreQuotes: quoteRows.data.length > PAGE_QUOTES,
    alongside: alongsideRefs.flatMap((r) => {
      const b = bySlug.get(r.slug);
      return b ? [{ book: withReaders(b), why: r.why }] : [];
    }),
    topics: [...topicCount.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([t]) => t),
    indexable: isIndexable({ bio_status: a.bio_status, books: rows.length, quotes: quoteRows.data.length }),
  };
}

/** Indexable author pages, for the sitemap and llms.txt. */
export async function indexableAuthors(): Promise<{ slug: string; name: string }[]> {
  const { data, error } = await db().rpc("author_stats");
  if (error) throw error;
  return data.filter(isIndexable).map((a) => ({ slug: a.slug, name: a.name })).sort((x, y) => x.name.localeCompare(y.name));
}

// ---- Admin ------------------------------------------------------------------

export type AdminAuthor = {
  id: string;
  slug: string;
  name: string;
  status: AuthorBioStatus;
  bio: string;
  sources: { title: string; url: string }[];
  born: number | null;
  died: number | null;
  role: string;
  places: string;
  wikidataId: string | null;
  alongside: { slug: string; why: string }[];
  updatedAt: string;
};

/** Drafted or approved author pages, newest change first. */
export async function adminAuthors(status: "draft" | "approved"): Promise<AdminAuthor[]> {
  const { data, error } = await db().from("authors").select("*").eq("bio_status", status).order("updated_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data.map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    status: a.bio_status,
    bio: a.bio,
    sources: (a.bio_sources as AdminAuthor["sources"] | null) ?? [],
    born: a.born,
    died: a.died,
    role: a.role,
    places: a.places,
    wikidataId: a.wikidata_id,
    alongside: (a.alongside as AdminAuthor["alongside"] | null) ?? [],
    updatedAt: a.updated_at,
  }));
}

export const AuthorEdit = z.object({
  bio: z.string().trim().max(1500).optional(),
  role: z.string().trim().max(120).optional(),
  places: z.string().trim().max(120).optional(),
  born: Year.nullable().optional(),
  died: Year.nullable().optional(),
  /** approve: publish it; draft: take it back off the page; none: discard the draft. */
  status: z.enum(["approved", "draft", "none"]).optional(),
});

/** An editor's edit and/or approval. False when there's no such author. */
export async function editAuthor(id: string, edit: z.infer<typeof AuthorEdit>): Promise<boolean> {
  const now = new Date().toISOString();
  const { status, ...fields } = edit;
  const { data, error } = await db()
    .from("authors")
    .update({
      ...fields,
      ...(status && { bio_status: status, approved_at: status === "approved" ? now : null }),
      ...(status === "none" && { bio: "", bio_sources: [], role: "", places: "", born: null, died: null, alongside: [] }),
      updated_at: now,
    })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return data.length > 0;
}

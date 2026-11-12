import "server-only";

import { z } from "zod";
import type { MaterialSummary } from "@/lib/api/types";
import { slugifyCategory } from "@/lib/categories/slug";
import { toMaterialSummary } from "@/lib/materials/summary";
import { resolveBookThumbnailSrc } from "@/lib/materials/image";
import { toDirectoryQuotes, type DirectoryQuote } from "@/lib/quotes/directory";
import { passageDay, PASSAGE_ZONE } from "@/lib/rooms/passage";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { addDays, localMinutes, zonedTime } from "@/lib/time/zone";
import { listTopics, topicCovers } from "@/lib/topics/guides";

// The monthly reading list (seo-spec.md C1): /reading-lists/<slug>. The
// connector drafts it while planning the calendar (send_reading_list); an
// editor approves it in /admin/reading-lists, and it goes live at 07:00
// Lagos on its day. "Live" is worked out from the clock on every read, so
// nothing has to flip it. migrations/20261215_reading_lists.sql.

const db = () => getSupabaseAdminClient();

const BOOK_FIELDS =
  "id, slug, material_type, title, author, description, cover_url, language, published_year, page_count_estimate, categories, thumbnail_url, google_meta_data, openlibrary_meta_data, cover_source, uploaded_by, visibility, status";

/** When a list goes live on its day, as the passage of the day. */
const LIVE_AT = "07:00";
const LIVE_MINUTES = 7 * 60;

type StoredBook = { slug: string; why: string; tag: string | null };
const booksOf = (json: unknown) => (Array.isArray(json) ? (json as StoredBook[]) : []);

/** The latest day whose list is live now: today from 07:00 Lagos, else yesterday. */
export function liveThrough(now = Date.now()): string {
  const today = passageDay(now);
  return localMinutes(now, PASSAGE_ZONE) >= LIVE_MINUTES ? today : addDays(today, -1);
}

/** The instant a list on `day` goes live. */
export const liveAt = (day: string) => new Date(zonedTime(day, LIVE_AT, PASSAGE_ZONE)).toISOString();

/** "December 2026" */
export const monthLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

// ---- Drafting (connector) ---------------------------------------------------

export const SendReadingListInput = z.object({
  title: z
    .string()
    .trim()
    .min(5)
    .max(120)
    .describe('What people search for: "Books on the Haitian Revolution", "Where to start with Pan-Africanism". No colons, no "Ultimate Guide", no number up front.'),
  day: z.iso.date().describe("The Lagos day it goes live, at 07:00: a key date's own day where the list is tied to one, else the 1st of the month."),
  occasion: z
    .string()
    .trim()
    .max(300)
    .default("")
    .describe('The key date it is tied to, as a plain fact ("Patrice Lumumba was killed on 17 January 1961."), or empty for an evergreen list.'),
  intro: z
    .string()
    .trim()
    .min(400)
    .max(1600)
    .describe("100–200 words, answer first: what the topic is, why it matters, and how the list runs (where to start, where it ends). One paragraph, or two separated by a blank line."),
  books: z
    .array(
      z.object({
        book: z.string().trim().min(1).max(200).describe("A public book's slug, from catalog."),
        why: z.string().trim().min(60).max(500).describe("Two or three sentences specific to this book, in the editors' voice: its argument, a scene, a fact, who it suits, how it answers another book on the list."),
        tag: z.string().trim().max(24).optional().describe('A short label where it helps: "Start here" on the first book, "Fiction", "Short", "Primary source". Most books have none.'),
      })
    )
    .min(6)
    .max(12)
    .describe("6–12 books in reading order, none twice."),
  topic: z.string().trim().max(120).optional().describe("A topic page's slug (from topics_to_write: a category's or an approved guide's) for the list's \"Go deeper\" link."),
});
export type SendReadingListInput = z.input<typeof SendReadingListInput>;

/** Saves the connector's draft of a reading list for an editor to approve.
 * A string is a problem for the AI to fix. */
export async function sendReadingList(raw: SendReadingListInput): Promise<{ slug: string; title: string; day: string } | string> {
  const input = SendReadingListInput.parse(raw);
  const slug = slugifyCategory(input.title);
  if (!slug) return "The title needs letters or numbers.";
  if (input.day <= liveThrough()) return `${input.day} has gone live already; pick a later day.`;

  const picks = input.books.map((b) => b.book);
  if (new Set(picks).size !== picks.length) return "A book appears twice.";
  const { data: found, error } = await db().from("materials").select("slug").in("slug", picks).eq("status", "published").eq("visibility", "public");
  if (error) throw error;
  const missing = picks.filter((s) => !found.some((b) => b.slug === s));
  if (missing.length) return `Not public books: ${missing.join(", ")}. Use slugs from catalog.`;

  if (input.topic && !(await listTopics()).some((t) => t.slug === input.topic)) return `No topic page "${input.topic}". Use a slug from topics_to_write, or leave topic out.`;

  const { data: existing, error: findError } = await db().from("reading_lists").select("id, status, day").eq("slug", slug).maybeSingle();
  if (findError) throw findError;
  if (existing?.status === "approved" && existing.day <= liveThrough()) return `A published list already has the title "${input.title}". Choose another title.`;

  const fields = {
    title: input.title,
    day: input.day,
    occasion: input.occasion,
    intro: input.intro,
    books: input.books.map((b) => ({ slug: b.book, why: b.why, tag: b.tag?.trim() || null })),
    topic: input.topic ?? null,
    status: "draft" as const,
    approved_at: null,
    updated_at: new Date().toISOString(),
  };
  const { error: saveError } = existing
    ? await db().from("reading_lists").update(fields).eq("id", existing.id)
    : await db().from("reading_lists").insert({ ...fields, slug });
  if (saveError) throw saveError;
  return { slug, title: input.title, day: input.day };
}

/** Lists for the calendar tool: the last year's and those planned, so the
 * connector plans the month's list without repeating a topic or book. */
export async function listsForPlanning() {
  const { data, error } = await db()
    .from("reading_lists")
    .select("title, day, occasion, status, books")
    .gte("day", addDays(passageDay(Date.now()), -365))
    .order("day", { ascending: false });
  if (error) throw error;
  const live = liveThrough();
  return data.map((l) => ({
    day: l.day,
    title: l.title,
    occasion: l.occasion || undefined,
    status: l.status === "draft" ? "waiting for review" : l.day <= live ? "published" : "approved",
    books: booksOf(l.books).map((b) => b.slug),
  }));
}

// ---- Reading ----------------------------------------------------------------

export type ListEntry = { book: MaterialSummary; why: string; tag: string | null; quote: DirectoryQuote | null };

export type ReadingListPage = {
  slug: string;
  title: string;
  intro: string;
  day: string;
  updatedAt: string;
  entries: ListEntry[];
  deeper: { slug: string; title: string; books: number; covers: string[] } | null;
  more: ListedReadingList[];
};

export type ListedReadingList = { slug: string; title: string; day: string; books: number; covers: string[] };

/** Entries that carry a quote under them: the first, then every fourth. */
const QUOTED = (i: number) => i % 4 === 0;

/** Everything a list's page shows, or null when it isn't live. */
export async function getReadingList(slug: string): Promise<ReadingListPage | null> {
  const { data: list, error } = await db().from("reading_lists").select("*").eq("slug", slug).eq("status", "approved").lte("day", liveThrough()).maybeSingle();
  if (error) throw error;
  if (!list) return null;

  const stored = booksOf(list.books);
  const [books, others, topics] = await Promise.all([
    db().from("materials").select(BOOK_FIELDS).in("slug", stored.map((b) => b.slug)).eq("status", "published").eq("visibility", "public"),
    listReadingLists(4),
    list.topic ? listTopics() : Promise.resolve([]),
  ]);
  if (books.error) throw books.error;
  const bySlug = new Map((books.data as unknown as { id: string; slug: string }[]).map((b) => [b.slug, b]));
  const present = stored.filter((b) => bySlug.has(b.slug));

  // One quote under some entries, from that book's directory quotes: the shortest.
  const quotedIds = present.filter((_, i) => QUOTED(i)).map((b) => bySlug.get(b.slug)!.id);
  const quoteRows = quotedIds.length
    ? await db().from("passage_quotes").select("id, material_id, ranges, topics").in("material_id", quotedIds).in("status", ["listed", "used"])
    : { data: [], error: null };
  if (quoteRows.error) throw quoteRows.error;
  const quotes = await toDirectoryQuotes(quoteRows.data);

  const entries = present.map((b, i): ListEntry => {
    const book = toMaterialSummary(bySlug.get(b.slug) as never);
    const quote = QUOTED(i) ? (quotes.filter((q) => q.book.slug === b.slug && q.text.length <= 320).sort((x, y) => x.text.length - y.text.length)[0] ?? null) : null;
    return { book, why: b.why, tag: b.tag, quote };
  });

  // "Go deeper": the topic page, with a few of its books' covers.
  const topic = topics.find((t) => t.slug === list.topic);
  const deeper = topic ? { slug: topic.slug, title: topic.title, books: topic.books, covers: await topicCovers(topic.slug) } : null;

  return {
    slug: list.slug,
    title: list.title,
    intro: list.intro,
    day: list.day,
    updatedAt: list.approved_at ?? list.updated_at,
    entries,
    deeper,
    more: others.filter((o) => o.slug !== list.slug).slice(0, 3),
  };
}

/** Live lists, newest first, with a few covers each: the hub, the sitemap,
 * llms.txt and "More reading lists". */
export async function listReadingLists(limit = 500): Promise<ListedReadingList[]> {
  const { data, error } = await db()
    .from("reading_lists")
    .select("slug, title, day, books")
    .eq("status", "approved")
    .lte("day", liveThrough())
    .order("day", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const firstSlugs = [...new Set(data.flatMap((l) => booksOf(l.books).slice(0, 4).map((b) => b.slug)))];
  const covers = new Map<string, string | null>();
  if (firstSlugs.length) {
    const { data: rows, error: e } = await db().from("materials").select(BOOK_FIELDS).in("slug", firstSlugs.slice(0, 1000));
    if (e) throw e;
    for (const r of rows) covers.set(r.slug, resolveBookThumbnailSrc(toMaterialSummary(r as never)));
  }
  return data.map((l) => {
    const books = booksOf(l.books);
    return {
      slug: l.slug,
      title: l.title,
      day: l.day,
      books: books.length,
      covers: books.slice(0, 4).flatMap((b) => covers.get(b.slug) ?? []),
    };
  });
}

/** Live lists that go deeper into a topic page, newest first: its "Reading lists" links. */
export async function listsForTopic(topic: string): Promise<{ slug: string; title: string }[]> {
  const { data, error } = await db().from("reading_lists").select("slug, title").eq("topic", topic).eq("status", "approved").lte("day", liveThrough()).order("day", { ascending: false }).limit(5);
  if (error) throw error;
  return data;
}

/** Lists that went live in [since, now], for IndexNow (seo-spec T10). */
export async function listsLiveSince(since: string): Promise<string[]> {
  const { data, error } = await db()
    .from("reading_lists")
    .select("slug, day, updated_at")
    .eq("status", "approved")
    .gte("day", addDays(since.slice(0, 10), -1))
    .lte("day", liveThrough());
  if (error) throw error;
  return data.filter((l) => liveAt(l.day) >= since || l.updated_at >= since).map((l) => l.slug);
}

// ---- Admin ------------------------------------------------------------------

export type AdminReadingList = {
  id: string;
  slug: string;
  title: string;
  intro: string;
  day: string;
  occasion: string;
  topic: string | null;
  status: "draft" | "approved";
  live: boolean;
  books: { slug: string; title: string; why: string; tag: string | null }[];
  updatedAt: string;
};

/** Drafted or approved lists, by day (drafts soonest first, approved newest first), with book titles. */
export async function adminReadingLists(status: "draft" | "approved"): Promise<AdminReadingList[]> {
  const { data, error } = await db().from("reading_lists").select("*").eq("status", status).order("day", { ascending: status === "draft" }).limit(200);
  if (error) throw error;
  const slugs = [...new Set(data.flatMap((l) => booksOf(l.books).map((b) => b.slug)))];
  const titles = new Map<string, string>();
  for (let i = 0; i < slugs.length; i += 300) {
    const { data: rows, error: e } = await db().from("materials").select("slug, title").in("slug", slugs.slice(i, i + 300));
    if (e) throw e;
    for (const b of rows) titles.set(b.slug, b.title);
  }
  const live = liveThrough();
  return data.map((l) => ({
    id: l.id,
    slug: l.slug,
    title: l.title,
    intro: l.intro,
    day: l.day,
    occasion: l.occasion,
    topic: l.topic,
    status: l.status,
    live: l.status === "approved" && l.day <= live,
    books: booksOf(l.books).map((b) => ({ ...b, title: titles.get(b.slug) ?? `${b.slug} (gone)` })),
    updatedAt: l.updated_at,
  }));
}

export const ReadingListEdit = z.object({
  title: z.string().trim().min(5).max(120).optional(),
  intro: z.string().trim().max(2000).optional(),
  day: z.iso.date().optional(),
  /** The same books, with their words edited. */
  books: z.array(z.object({ slug: z.string(), why: z.string().trim().max(500), tag: z.string().trim().max(24).nullable() })).max(12).optional(),
  /** approved: publish it on its day; draft: take it back off the site; none: discard it. */
  status: z.enum(["approved", "draft", "none"]).optional(),
});

/** An editor's edit and/or approval. False when there's no such list. */
export async function editReadingList(id: string, edit: z.infer<typeof ReadingListEdit>): Promise<boolean> {
  if (edit.status === "none") {
    const { data, error } = await db().from("reading_lists").delete().eq("id", id).select("id");
    if (error) throw error;
    return data.length > 0;
  }
  const now = new Date().toISOString();
  const { status, books, ...fields } = edit;
  const { data, error } = await db()
    .from("reading_lists")
    .update({
      ...fields,
      ...(books && { books: books.map((b) => ({ ...b, tag: b.tag || null })) }),
      ...(status && { status, approved_at: status === "approved" ? now : null }),
      updated_at: now,
    })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return data.length > 0;
}

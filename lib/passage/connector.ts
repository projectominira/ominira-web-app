import "server-only";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { CATEGORIES_CACHE_TAG } from "@/lib/categories/config";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { fetchMaterialManifest } from "@/lib/materials/manifest";
import { UUID_RE } from "@/lib/materials/resolve";
import { slugFromTitle, uniqueSlug } from "@/lib/materials/uniqueSlug";
import { allRows } from "@/lib/supabase/allRows";
import type { TocSection } from "@/lib/api/types";
import type { Database } from "@/lib/supabase/database.types";
import { createSet, CreateSetInput, listDays } from "./sets";
import { getBrief, getCalendar } from "./calendar";
import { logAuthor, logCategories, logEdits, logList, logPassages, logQuotes, logTags, logTopic, type BookEdit, type CategoryChange } from "./activity";
import { addQuotes, AddQuotesInput, booksToQuote, MAX_QUOTES_PER_BOOK } from "@/lib/quotes/directory";
import { authorsToWrite, writeAuthor, WriteAuthorInput } from "@/lib/authors/authors";
import { topicsToWrite, writeTopic, WriteTopicInput } from "@/lib/topics/guides";
import { listsForPlanning, sendReadingList, SendReadingListInput } from "@/lib/readingLists/lists";
import { passageDay } from "@/lib/rooms/passage";
import { addDays } from "@/lib/time/zone";
import { isScanned, loadBookText, normalise, type BookText, type TextBlock } from "./text";

// The tools the Ominira connector (passage-spec §6) gives an editor's AI:
// browse the library, read and search a book's text, see recent passages,
// and send a set to /admin/passage; and tag books with categories, adding
// new categories where none fits. Text comes straight from each book's
// file (lib/passage/text.ts); nothing is indexed.

const db = () => getSupabaseAdminClient();

type MaterialUpdate = Database["public"]["Tables"]["materials"]["Update"];

export const INSTRUCTIONS = `You help an Ominira editor with five jobs in Ominira's library of books: finding short, quotable passages (and planning the monthly reading list), curating the quote directory, drafting author pages, writing topic guides, and looking after the books (their categories and details).

## Passages

Passages are shared as images or as the passage of the day: the quote alone, with one line of context above it. Each morning at 07:00 Lagos time Ominira posts the day's approved passage on its own, from a calendar of the next 30 days.

### Planning the calendar

When the editor asks you to plan or fill days ("plan the next 30 days", "fill next week"), work on your own, without asking for themes:
1. Call \`calendar\` first. Follow its editorial brief: it is the editors' taste and their list of key dates.
2. Anniversaries: find the dates in the open days that matter to Pan-African and emancipatory history (the brief's key dates first). Confirm each date with a web search before using it. Send each with \`kind: "anniversary"\` and its \`day\`.
3. Topical: work from what the editor raises, or search the news when asked. Use a passage only when it sheds light on the moment, not because it shares a word. \`kind: "topical"\`.
4. Evergreen: fill the remaining open days with strong passages. Use what readers already love as a taste guide (Goodreads quotes, well-known speeches, wherever Pan-Africanist thought is shared), then find those words, or better ones, in Ominira's own edition: only the library's text can be sent.
5. Spread books and authors: avoid the ones \`calendar\` lists as featured recently, and don't repeat a book within the same batch.
6. Give every quote an \`occasion\`: the one line of context members see above the quote. A plain fact, not a prompt: for an anniversary, what happened that day ("Ken Saro-Wiwa and eight other Ogoni men were executed on 10 November 1995."); for a topical one, the event; for an evergreen one, who wrote it and what the book is.
7. A month is a lot of reading for one chat: plan anniversaries and topical days first, then evergreen, and send each batch with \`send_to_ominira\` as its own set once it's ready: asking you to plan is asking you to send. Editors approve each quote in Ominira; nothing is posted without them.
8. The monthly reading list: each month in the window gets one list (\`calendar\` shows \`reading_lists\`, past and planned). Tie it to the month's strongest key date where there is one ("Books on Lumumba" for 17 January), on that day and sharing it with that day's passage; otherwise take an evergreen topic people search for (the Haitian Revolution, the Mau Mau, apartheid, where to start with Pan-Africanism, women in Africa's freedom struggles, the Cuban Revolution, Nigeria, decolonising the mind) on the 1st. Avoid topics, books and authors used in recent lists. Pick 6–12 books with \`catalog\` and read enough with \`find\` and \`read\` to say something specific about each, ordered so a reader knows where to start. Title it as people search ("Books on the Haitian Revolution", "Where to start with Fanon"), plain, no colons or numbers up front. Introduction 100–200 words, answer first, facts checked. For each book two or three sentences in an editor's voice: its argument, a scene, a fact, who it suits; if a sentence could describe another book, rewrite it. Same banned filler as the topic guides. Link the topic page it belongs to (\`topics_to_write\` gives slugs) as \`topic\`. Send it with \`send_reading_list\`.

### Finding passages for an idea

How to work:
1. Understand the editor's idea (a theme, an anniversary, a conversation in the news).
2. Shortlist books with \`catalog\` (a query filters title, author, category and description, and shows chapter titles).
3. Use \`find\` to locate likely blocks, then \`contents\` and \`read\` to check each candidate in its context.
4. Discuss the candidates with the editor.
5. Call \`send_to_ominira\` only when the editor asks you to.

### Every quote
- Quote word for word from \`read\` output. A quote that isn't found verbatim in the book is rejected.
- Keep quotes short (one to three sentences) and self-contained: they must make sense without what comes before.
- For each quote, pass \`near\` (the block id or page number \`read\` showed) and say why it fits.
- Check \`recent_passages\` and avoid repeating recent quotes or books.

## Curating the quote directory

Ominira's quote directory (/quotes) shows quotes from every book, word for word from Ominira's edition. The same quotes fill author and topic pages, so they are what readers searching "<author> quotes" find. Quotes go live as soon as you send them (they're checked word for word); editors can hide one later.

When the editor asks you to curate quotes ("curate the new books", "add quotes from Fanon"), work on your own:
1. Call \`books_to_quote\` for books not yet curated, or pick books with \`catalog\` when the editor names some.
2. For each book, use what readers already quote as a guide (Goodreads quotes, well-known lines), then \`find\` and \`read\` to locate them, or better ones, in the book. Read enough of the book to choose well, not just the opening.
3. Choose up to about 8 quotes a book (never more than ${MAX_QUOTES_PER_BOOK}): its strongest, most quotable lines, one to three sentences, each making sense on its own. Skip tables of contents, front matter, editors' introductions and other people's words quoted in the book. A book with nothing worth quoting gets none.
4. Give each quote one to three topics from \`categories\`.
5. Send each book's quotes with \`add_quotes\` as soon as it's done, passing books you skipped in \`done\`. Re-sending a listed quote is skipped, so a run can safely resume.
6. Finish with a short report: books curated, quotes added, and anything skipped.

## Drafting author pages

Each author in the library has a page (/authors/<slug>) with their books and quotes. You draft the rest: a short bio, the facts line under their name, sources, and books to read alongside. An editor approves each draft before it shows.

When the editor asks ("write the author pages", "draft Fanon's page"), work on your own:
1. Call \`authors_to_write\` for authors with no draft yet, most books first, or take the authors the editor names.
2. Check the facts on Wikipedia and Wikidata (and a reliable biography when they disagree): dates, places, works, roles. Leave out anything you can't verify. Pass the Wikidata item only when you're sure it is this person.
3. Write the bio in your own words, 80–150 words, never copied or closely paraphrased. Open with who they were and why they matter, then the life: concrete names, dates and places, the books in the library where they fit. Plain English, no filler ("delve", "tapestry", "testament to", "rich legacy", "journey", "powerful", "seminal"), no closing sermon. It should read as a well-read Pan-Africanist editor wrote it for a friend.
4. Portrait: take the image on their Wikidata item (P18), which lives on Wikimedia Commons. Pass the thumbnail URL Commons gives for the file (its API: action=query&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=400, the thumburl), with its credit from the file's Commons page: "Photo: <author>, <licence>, via Wikimedia Commons", or "Public domain, via Wikimedia Commons". No image from anywhere else, and none when you're not sure it shows this person.
5. Read alongside: up to 4 books by other authors in the library (find them with \`catalog\`), each with one specific sentence on the link: a teacher, a reply, the same struggle elsewhere. Skip it rather than pad it.
6. Send each author with \`write_author\` as soon as it's done. Sending again replaces the draft.
7. Finish with a short report: authors drafted, and any you skipped and why.

## Writing topic guides

Each library category, and each broad topic the editors choose ("The Haitian Revolution", "Mau Mau", "Négritude"), has a page (/topics/<slug>) that aims to be the best answer to "books on <topic>". You write its guide: a title, an introduction and a reading path of about 20 books. It goes live as soon as you send it; editors can edit or remove it later. Below the guide, a category's page lists every book in it.

When the editor asks ("write the topic guides", "draft a guide to the Haitian Revolution"), work on your own:
1. Call \`topics_to_write\`: every category with its book count and whether it has a guide, and the broad topics written so far. Take categories with no guide, most books first, or the topics the editor names.
2. Shortlist books with \`catalog\` (query the topic, its people, places and events; a category's books carry its name). Choose about 20 that together explain the topic, from any category. Read enough with \`contents\`, \`find\` and \`read\` to say something specific about each.
3. Order them as a reading path in two to four stages: start here (the clearest way in), go deeper, then the arguments or a stage of the topic's own (a period, a country, a debate). Give each stage a plain title and one or two sentences on what it covers.
4. For each book, one or two sentences specific to that book: its argument, a scene, a fact, where it sits in the path, who it suits. If the sentence could describe another book, rewrite it. Say which book answers which when they disagree.
5. Title it in the words people search for: "Books on the Haitian Revolution", "Where to start with Pan-Africanism". Plain, no colons, no "Ultimate Guide", and not the same template for every topic.
6. Introduction, 150–300 words, answer first: what the topic is and why it matters, with names, dates and places checked on reliable sources, then a sentence on how the path runs. Your own words, plain English, no filler ("delve", "tapestry", "testament to", "rich history", "journey", "shed light on", "a must-read", "powerful", "seminal"), no closing sermon.
7. Each stage shows one quote from its own books, taken from the quote directory. If a stage's books have no quotes yet, add a few with \`add_quotes\` first.
8. Send each guide with \`write_topic\` as soon as it's done (category: true for a category). Sending again replaces the guide.
9. Finish with a short report: guides published, and any topics you skipped and why.

## Tagging books

Categories are how members browse the library and pick their interests, so each one should be a topic a reader would look for.

How to work:
1. Call \`categories\` to see every category and how many books it has.
2. Call \`books_to_tag\` for the books with no category yet (page through with \`offset\`), or with \`untagged: false\` to review existing tags.
3. Give each book one to three categories that say what it is about, preferring existing categories.
4. Propose a new category only when no existing one fits and several books in the library belong in it. Keep its name short and in the style of the existing ones (e.g. "Marxism & Socialism"). Agree new categories with the editor first.
5. Call \`tag_books\` when the editor asks. It replaces each book's categories, so pass the full list for every book.
6. To rename, merge or remove a category, use \`edit_categories\` when the editor asks. It updates every book and reader at once; don't retag books by hand for this.

## Tidying book details

Titles and authors come from uploads and are often messy: all caps, file names, "Unknown", subtitles run together, an editor's name where the author should be.

When the editor asks in any words ("fix books with wrong details", "tidy the authors"), work on your own, without asking them to name books or confirm each fix:
1. Call \`books_to_fix\` and page through it. It lists books showing signs of a problem, each with its hints. Hints are leads, not verdicts: fix what is wrong, leave what is right. With \`all: true\` it lists every book, for a full check or when the editor asks about something hints can't see (a misspelled name, the wrong author).
2. Use each book's published form:
   - Title as printed, in title case, with a subtitle after a colon ("Technofeudalism: What Killed Capitalism"). Drop series names in brackets and stray punctuation (" -- ", " : ").
   - Authors by their usual full name, first name first, joined with commas ("Cheikh Anta Diop", "W. E. B. Du Bois", "Toyin Falola, Jessica Achberger"), spelled the same on every book.
   - Year: fill a missing one with the year the work was first published. Leave existing years alone unless plainly wrong.
   - Description: fill a missing one only with a short, factual summary you are sure of.
   - Pirate-library names, hashes and file details never belong in a book: strip "Z-Library", "z-lib.org", "1lib", "Anna's Archive", "PDFDrive", ISBNs, 32-character hashes and publisher/year tails from titles, and pass \`fix_slug: true\` for every book whose hints say its slug carries them. The slug is remade from the (fixed) title and the old link redirects.
   Check with a web search when unsure. If still unsure, leave the book and say so.
3. Send the fixes with \`edit_books\` as you go, up to 100 a call, passing only the fields that change.
4. Finish with a short report: how many books you fixed, a few examples, and any you left for the editor. Every change, before and after, is kept in the Connector history.`;

/** About 4 characters a token. */
const tokens = (chars: number) => Math.ceil(chars / 4);
/** What one `read` returns at most (~8k tokens). */
const READ_CHARS = 32_000;

const BookKey = z.string().trim().min(1).max(200).describe("A book's slug (from catalog) or id.");

type Book = { id: string; slug: string; title: string; author: string; material_type: string; json_storage_path: string | null; source_url: string | null };

async function findBook(key: string): Promise<{ book: Book; text: BookText }> {
  const { data, error } = await db()
    .from("materials")
    .select("id, slug, title, author, material_type, status, visibility, json_storage_path, source_url")
    .eq(UUID_RE.test(key) ? "id" : "slug", key)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status !== "published" || data.visibility !== "public") throw new ToolError(`No public book "${key}". Use a slug from catalog.`);
  const load = loadBookText(data);
  if (!load) throw new ToolError(`"${data.title}" isn't an EPUB or PDF, so it has no text to read.`);
  const text = await load;
  if (isScanned(text)) throw new ToolError(`"${data.title}" is a scanned PDF: it has no text to read.`);
  return { book: data, text };
}

class ToolError extends Error {}

/** How a block appears to the AI: an EPUB passage's id, or a PDF's page. */
const blockRef = (kind: BookText["kind"], block: TextBlock, index: number) => (kind === "pdf" ? `page ${index + 1}` : block.id);
/** A block's text as `read` shows it: what a quote must match. */
const shown = (kind: BookText["kind"], block: TextBlock) => normalise(block.text, kind === "pdf");

/** Chapters (EPUB: runs of blocks under one heading) or page groups (PDF). */
function parts(text: BookText): { title: string; from: number; to: number }[] {
  if (text.kind === "pdf") {
    const out = [];
    for (let i = 0; i < text.blocks.length; i += 25) {
      const to = Math.min(i + 25, text.blocks.length) - 1;
      out.push({ title: `Pages ${i + 1}–${to + 1}`, from: i, to });
    }
    return out;
  }
  // Unlabelled blocks (front matter, mostly) join the part before them.
  const out: { title: string; from: number; to: number }[] = [];
  text.blocks.forEach((b, i) => {
    const last = out.at(-1);
    if (last && (!b.label || last.title === b.label)) last.to = i;
    else out.push({ title: b.label || "Front matter", from: i, to: i });
  });
  return out;
}

/** Where `from` points: a block id, or a PDF page number. */
function blockIndex(text: BookText, from: string | number): number {
  const index = typeof from === "number" || /^\d+$/.test(from) ? Number(from) - 1 : text.blocks.findIndex((b) => b.id === from);
  if (index < 0 || index >= text.blocks.length) throw new ToolError(`No block or page "${from}" in this book.`);
  return index;
}

// ---- Tools ----------------------------------------------------------------

const Catalog = z.object({
  query: z.string().trim().max(200).optional().describe("Words to filter by: title, author, category or description. Leave out to list every book briefly."),
});

async function catalog({ query }: z.infer<typeof Catalog>) {
  const books = (await publicBooks()).filter((b) => b.material_type === "book" || b.material_type === "pdf");
  if (!query) {
    // The whole list, kept short: one line a book.
    return {
      count: books.length,
      books: books.map((b) => [b.slug, b.title, b.author, b.published_year, b.material_type === "pdf" ? "PDF" : "EPUB"].filter(Boolean).join(" | ")),
      note: "slug | title | author | year | type. Call catalog with a query for descriptions and chapter titles.",
    };
  }
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = books
    .map((b) => {
      const head = `${b.title} ${b.author} ${b.categories.join(" ")}`.toLowerCase();
      const body = (b.description ?? "").toLowerCase();
      return { b, score: words.reduce((s, w) => s + (head.includes(w) ? 3 : 0) + (body.includes(w) ? 1 : 0), 0) };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 25);
  const chapters = await Promise.all(scored.map(({ b }) => (b.json_storage_path ? chapterTitles(b.json_storage_path) : null)));
  return {
    count: scored.length,
    books: scored.map(({ b }, i) => ({
      slug: b.slug,
      title: b.title,
      author: b.author,
      year: b.published_year,
      type: b.material_type === "pdf" ? "PDF" : "EPUB",
      categories: b.categories,
      description: b.description?.slice(0, 600) ?? null,
      chapters: chapters[i],
    })),
  };
}

/** An EPUB's top-level chapter titles, from its manifest; null for a PDF or
 * when the manifest can't be read. */
async function chapterTitles(jsonKey: string): Promise<string | null> {
  const manifest = await fetchMaterialManifest(jsonKey).catch(() => null);
  const titles = (manifest?.toc ?? []).flatMap((s: TocSection) => (s.label ? [s.label] : []));
  return titles.length ? titles.join(" · ").slice(0, 1200) : null;
}

const Contents = z.object({ book: BookKey });

async function contents({ book: key }: z.infer<typeof Contents>) {
  const { book, text } = await findBook(key);
  return {
    book: book.title,
    author: book.author,
    type: text.kind === "pdf" ? "PDF" : "EPUB",
    tokens: tokens(text.search.length),
    parts: parts(text).map((p, i) => ({
      chapter: i + 1,
      title: p.title,
      starts: blockRef(text.kind, text.blocks[p.from], p.from),
      tokens: tokens(text.blocks.slice(p.from, p.to + 1).reduce((n, b) => n + b.text.length, 0)),
    })),
  };
}

const Read = z.object({
  book: BookKey,
  chapter: z.int().positive().optional().describe("A chapter number from contents."),
  from: z.union([z.string(), z.int().positive()]).optional().describe("Start at this block id or page number (e.g. a \"continue from\" marker)."),
  to: z.union([z.string(), z.int().positive()]).optional().describe("Stop after this block id or page number."),
});

async function read({ book: key, chapter, from, to }: z.infer<typeof Read>) {
  const { book, text } = await findBook(key);
  let start = 0;
  let end = text.blocks.length - 1;
  if (chapter !== undefined) {
    const part = parts(text)[chapter - 1];
    if (!part) throw new ToolError(`No chapter ${chapter}. Call contents for the chapter numbers.`);
    start = part.from;
    end = part.to;
  }
  if (from !== undefined) start = blockIndex(text, from);
  if (to !== undefined) end = blockIndex(text, to);
  if (chapter === undefined && from === undefined) throw new ToolError("Give a chapter, or a block or page to start from.");

  const lines: string[] = [];
  let size = 0;
  let i = start;
  for (; i <= end; i++) {
    const line = `[${blockRef(text.kind, text.blocks[i], i)}] ${shown(text.kind, text.blocks[i])}`;
    if (size + line.length > READ_CHARS && lines.length > 0) break;
    lines.push(line);
    size += line.length;
  }
  const more = i <= end;
  return [
    `${book.title} — ${book.author}${text.kind === "book" && text.blocks[start]?.label ? ` · ${text.blocks[start].label}` : ""}`,
    "",
    ...lines,
    "",
    more ? `[continue from: ${text.kind === "pdf" ? i + 1 : text.blocks[i].id}]` : "[end of the requested text]",
  ].join("\n");
}

const Find = z.object({
  books: z.array(BookKey).min(1).max(10).describe("Up to 10 book slugs to search."),
  terms: z.array(z.string().trim().min(1).max(100)).min(1).max(10).describe("Words or phrases to look for, matched case-insensitively."),
  limit: z.int().min(1).max(50).default(20),
});

async function find({ books, terms, limit }: z.infer<typeof Find>) {
  const wanted = terms.map((t) => normalise(t).toLowerCase());
  const loaded = await Promise.all(books.map((b) => findBook(b).catch((err: Error) => err)));
  const hits: { book: string; at: string; chapter: string; score: number; snippet: string }[] = [];
  const skipped: string[] = [];
  loaded.forEach((r, n) => {
    if (r instanceof Error) {
      skipped.push(`${books[n]}: ${r.message}`);
      return;
    }
    const { book, text } = r;
    text.blocks.forEach((block, i) => {
      const body = shown(text.kind, block);
      const lower = body.toLowerCase();
      let score = 0;
      let first = -1;
      for (const term of wanted) {
        let count = 0;
        for (let at = lower.indexOf(term); at >= 0 && count < 20; at = lower.indexOf(term, at + term.length)) {
          if (first < 0 || at < first) first = at;
          count++;
        }
        if (count) score += 10 + count;
      }
      if (!score) return;
      const s = Math.max(0, first - 100);
      hits.push({
        book: book.slug,
        at: blockRef(text.kind, block, i),
        chapter: text.kind === "pdf" ? `p. ${i + 1}` : block.label,
        score,
        snippet: `${s > 0 ? "…" : ""}${body.slice(s, s + 280)}${s + 280 < body.length ? "…" : ""}`,
      });
    });
  });
  hits.sort((a, b) => b.score - a.score);
  return { results: hits.slice(0, limit).map((h) => ({ book: h.book, at: h.at, chapter: h.chapter, snippet: h.snippet })), total: hits.length, ...(skipped.length ? { skipped } : {}) };
}

const Categories = z.object({});

/** Published public books (any type) with their categories. */
/** Every public book, by title. Paged: a plain select stops at 1000 rows. */
async function publicBooks() {
  const data = await allRows((from, to) =>
    db()
      .from("materials")
      .select("id, slug, old_slugs, title, author, published_year, material_type, categories, description, json_storage_path")
      .eq("status", "published")
      .eq("visibility", "public")
      .order("title")
      .order("id")
      .range(from, to)
  );
  return data.map((m) => ({ ...m, categories: Array.isArray(m.categories) ? (m.categories as string[]) : [] }));
}

async function categoryNames(): Promise<string[]> {
  const { data, error } = await db().from("categories").select("name").order("position");
  if (error) throw error;
  return data.map((c) => c.name);
}

async function listCategories() {
  const [names, books] = await Promise.all([categoryNames(), publicBooks()]);
  const count = new Map<string, number>();
  for (const b of books) for (const c of b.categories) count.set(c, (count.get(c) ?? 0) + 1);
  return { categories: names.map((name) => ({ name, books: count.get(name) ?? 0 })), books: books.length, untagged: books.filter((b) => !b.categories.length).length };
}

const ToTag = z.object({
  untagged: z.boolean().default(true).describe("Only books with no category yet. False lists every book, to review existing tags."),
  offset: z.int().min(0).default(0),
  limit: z.int().min(1).max(100).default(50),
});

async function booksToTag({ untagged, offset, limit }: z.infer<typeof ToTag>) {
  const books = (await publicBooks()).filter((b) => !untagged || !b.categories.length);
  return {
    total: books.length,
    books: books.slice(offset, offset + limit).map((b) => ({
      slug: b.slug,
      title: b.title,
      author: b.author,
      year: b.published_year,
      categories: b.categories,
      description: b.description?.slice(0, 500) ?? null,
    })),
    next: offset + limit < books.length ? offset + limit : null,
  };
}

const ToFix = z.object({
  all: z.boolean().default(false).describe("Every book instead of only those with hints."),
  offset: z.int().min(0).default(0),
  limit: z.int().min(1).max(100).default(100),
});

/** Signs a book's details need a look; the AI decides. */
/** A slug carrying a pirate-library name, a hash, an ISBN or the file name's author/publisher tail. */
function slugIsMessy(slug: string, title: string): boolean {
  return /z-?lib|1lib|anna-s-arc|pdfdrive|libgen|isbn|[0-9a-f]{32}/.test(slug) || slug.length > slugFromTitle(title).length + 12;
}

function hints(b: { slug: string; title: string; author: string; published_year: number | null; description: string | null }): string[] {
  const out: string[] = [];
  const { title, author } = b;
  if (slugIsMessy(b.slug, title)) out.push("slug carries a pirate-library name, hash or file details: pass fix_slug");
  const letters = title.replace(/[^A-Za-z]/g, "");
  if (letters.length > 3 && (letters === letters.toUpperCase() || letters === letters.toLowerCase())) out.push("title all upper or lower case");
  if (/[_]|\.(pdf|epub|txt)$|--|\s[-–:]\s|\s:/i.test(title)) out.push("title has file-name or odd punctuation");
  if (/[([]/.test(title)) out.push("title has brackets (series or edition?)");
  if (!author.trim() || /unknown|anonymous|various/i.test(author)) out.push("author missing or unknown");
  const authorLetters = author.replace(/[^A-Za-z]/g, "");
  if (authorLetters.length > 3 && authorLetters === authorLetters.toUpperCase()) out.push("author all upper case");
  if (author.includes(",")) out.push("author has a comma (surname first, or several names?)");
  if (/\d|[()]/.test(author)) out.push("author has dates, brackets or a book's details: authors are names only");
  if (/\.$/.test(author.trim()) || /\.[A-Za-z]/.test(author) || /\b[A-Z]\b(?!\.)/.test(author)) out.push("author initials or punctuation look off");
  if (/\b(ed\.|eds\.|editor|translated|trans\.)/i.test(author)) out.push("author may be an editor or translator");
  if (b.published_year === null) out.push("no year");
  if (!b.description?.trim()) out.push("no description");
  return out;
}

async function booksToFix({ all, offset, limit }: z.infer<typeof ToFix>) {
  // Title and author problems first; a missing year or description after.
  const minor = (h: string) => h === "no year" || h === "no description";
  const books = (await publicBooks())
    .map((b) => ({ b, hints: hints(b) }))
    .filter((x) => all || x.hints.length)
    .sort((x, y) => Number(x.hints.every(minor)) - Number(y.hints.every(minor)));
  return {
    total: books.length,
    books: books.slice(offset, offset + limit).map(({ b, hints }) => ({
      slug: b.slug,
      title: b.title,
      author: b.author,
      year: b.published_year,
      description: b.description?.slice(0, 300) ?? null,
      hints,
    })),
    next: offset + limit < books.length ? offset + limit : null,
  };
}

const CategoryName = z.string().trim().min(2).max(40);

const Tag = z.object({
  books: z.array(z.object({ book: BookKey, categories: z.array(CategoryName).min(1).max(5) })).min(1).max(100),
  new_categories: z
    .array(CategoryName)
    .max(10)
    .default([])
    .describe("Categories to create. A category that is neither existing nor listed here is rejected, so a typo can't make a near-duplicate."),
});

async function tagBooks({ books, new_categories }: z.infer<typeof Tag>, origin: string) {
  // Names match case-insensitively and are stored as already spelled.
  const names = await categoryNames();
  const canonical = new Map(names.map((n) => [n.toLowerCase(), n]));
  const fresh = new Map<string, string>();
  for (const n of new_categories) if (!canonical.has(n.toLowerCase())) fresh.set(n.toLowerCase(), n);
  const unknown = new Set<string>();
  const wanted = books.map(({ book, categories }) => ({
    book,
    categories: [
      ...new Set(
        categories.map((c) => {
          const name = canonical.get(c.toLowerCase()) ?? fresh.get(c.toLowerCase());
          if (!name) unknown.add(c);
          return name ?? c;
        })
      ),
    ],
  }));
  if (unknown.size) throw new ToolError(`Unknown categories: ${[...unknown].join(", ")}. Use an existing name from categories, or list it in new_categories.`);

  const byKey = new Map<string, { id: string; slug: string; title: string }>();
  for (const b of await publicBooks()) byKey.set(b.slug, b).set(b.id, b);
  const skipped = wanted.filter((w) => !byKey.has(w.book)).map((w) => `${w.book}: no public book with this slug`);
  const found = wanted.filter((w) => byKey.has(w.book));

  // Only categories some book actually uses are created.
  const used = new Set(found.flatMap((w) => w.categories));
  const created = [...fresh.values()].filter((n) => used.has(n));
  if (created.length) {
    const last = await db().from("categories").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
    if (last.error) throw last.error;
    const { error } = await db()
      .from("categories")
      .insert(created.map((name, i) => ({ name, position: (last.data?.position ?? 0) + 1 + i })));
    if (error) throw error;
    revalidateTag(CATEGORIES_CACHE_TAG, "max");
  }

  for (let i = 0; i < found.length; i += 10) {
    await Promise.all(
      found.slice(i, i + 10).map(async (w) => {
        const { error } = await db().from("materials").update({ categories: w.categories }).eq("id", byKey.get(w.book)!.id);
        if (error) throw error;
      })
    );
  }
  if (found.length) {
    await logTags(
      found.map((w) => {
        const b = byKey.get(w.book)!;
        return { title: b.title, slug: b.slug, categories: w.categories };
      }),
      created
    );
  }
  return { tagged: found.length, created, ...(skipped.length ? { skipped } : {}), review: `${origin}/admin/library` };
}

const Edit = z.object({
  books: z
    .array(
      z.object({
        book: BookKey,
        title: z.string().trim().min(1).max(500).optional(),
        author: z.string().trim().min(1).max(300).optional(),
        year: z.int().min(0).max(3000).nullable().optional().describe("Year the work was first published; null clears it."),
        description: z.string().trim().max(10_000).nullable().optional().describe("Null clears it."),
        fix_slug: z
          .literal(true)
          .optional()
          .describe("Remake the book's slug (its link) from its title, dropping pirate-library names, hashes and file details. The old link keeps working: it redirects to the new one."),
      })
    )
    .min(1)
    .max(100),
});

/** Fixes books' details. With fix_slug the slug is remade from the title and
 * the old one kept in old_slugs, which redirect to it (seo-spec.md T2). */
async function editBooks({ books }: z.infer<typeof Edit>, origin: string) {
  const byKey = new Map<string, Awaited<ReturnType<typeof publicBooks>>[number]>();
  for (const b of await publicBooks()) byKey.set(b.slug, b).set(b.id, b);
  const skipped: string[] = [];
  const edits: (BookEdit & { id: string; update: MaterialUpdate })[] = [];
  for (const w of books) {
    const b = byKey.get(w.book);
    if (!b) {
      skipped.push(`${w.book}: no public book with this slug`);
      continue;
    }
    const fields = [
      ["title", "title", w.title, b.title],
      ["author", "author", w.author, b.author],
      ["year", "published_year", w.year, b.published_year],
      ["description", "description", w.description, b.description],
    ] as const;
    const changes: BookEdit["changes"] = [];
    const update: Record<string, unknown> = {};
    for (const [field, column, to, from] of fields) {
      if (to === undefined || to === from) continue;
      update[column] = to;
      changes.push({ field, from: from === null ? null : String(from), to: to === null ? null : String(to) });
    }
    const title = w.title ?? b.title;
    if (w.fix_slug && slugFromTitle(title) !== b.slug) {
      const slug = await uniqueSlug(title);
      update.slug = slug;
      update.old_slugs = [...b.old_slugs, b.slug];
      changes.push({ field: "slug", from: b.slug, to: slug });
    }
    if (changes.length) edits.push({ id: b.id, slug: (update.slug as string) ?? b.slug, title, changes, update: update as MaterialUpdate });
  }
  for (let i = 0; i < edits.length; i += 10) {
    await Promise.all(
      edits.slice(i, i + 10).map(async (e) => {
        const { error } = await db().from("materials").update(e.update).eq("id", e.id);
        if (error) throw error;
      })
    );
  }
  if (edits.length) await logEdits(edits.map(({ slug, title, changes }) => ({ slug, title, changes })));
  return { edited: edits.length, unchanged: books.length - edits.length - skipped.length, ...(skipped.length ? { skipped } : {}), review: `${origin}/admin/library` };
}

const EditCategories = z.object({
  changes: z
    .array(
      z.object({
        category: z.string().trim().min(1).max(40),
        to: CategoryName.nullable().describe("A new name renames it; an existing category's name merges it into that one; null removes it from every book."),
      })
    )
    .min(1)
    .max(20),
});

/** Renames, merges or removes categories everywhere at once (books, readers'
 * interests, Home's topic): rename_category in
 * migrations/20261206_rename_category.sql. */
async function editCategories({ changes }: z.infer<typeof EditCategories>) {
  const done: CategoryChange[] = [];
  const problems: string[] = [];
  for (const c of changes) {
    // Run in order, so each change sees the names the last one left.
    const canonical = new Map((await categoryNames()).map((n) => [n.toLowerCase(), n]));
    const from = canonical.get(c.category.toLowerCase());
    if (!from) {
      problems.push(`${c.category}: no such category`);
      continue;
    }
    const existing = c.to === null ? undefined : canonical.get(c.to.toLowerCase());
    // A case-only fix is a rename, not a merge into itself.
    const to = c.to === null ? null : existing && existing !== from ? existing : c.to;
    if (to === from) continue;
    const { data, error } = await db().rpc("rename_category", { old_name: from, new_name: to });
    if (error) throw error;
    done.push({ from, to, merged: !!existing && existing !== from, books: data ?? 0 });
  }
  if (done.length) {
    revalidateTag(CATEGORIES_CACHE_TAG, "max");
    await logCategories(done);
  }
  return { changed: done, ...(problems.length ? { problems } : {}) };
}

const Recent = z.object({ days: z.int().min(1).max(365).default(30) });

async function recentPassages({ days }: z.infer<typeof Recent>) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const out: { day: string; quote: string; book: string | null }[] = [];
  let cursor: string | null = null;
  do {
    const page = await listDays({ cursor });
    for (const d of page.items) if (d.day >= since) out.push({ day: d.day, quote: d.quote, book: d.book });
    cursor = page.items.at(-1)?.day && page.items.at(-1)!.day >= since ? page.nextCursor : null;
  } while (cursor);
  return { passages: out };
}

const CalendarInput = z.object({});

/** What planning needs (passage-spec §8.5): the brief, the next 30 days,
 * what's waiting for review, and the books and authors used lately. */
async function calendar() {
  const since = addDays(passageDay(Date.now()), -60);
  const [brief, cal, recent, lists] = await Promise.all([
    getBrief(),
    getCalendar(),
    db().from("daily_passages").select("post_id").gte("day", since),
    listsForPlanning(),
  ]);
  if (recent.error) throw recent.error;
  const posts = recent.data.length
    ? await db().from("posts").select("material_id").in("id", recent.data.map((r) => r.post_id))
    : { data: [], error: null };
  if (posts.error) throw posts.error;
  const ids = [...new Set(posts.data.flatMap((p) => (p.material_id ? [p.material_id] : [])))];
  const books = ids.length ? await db().from("materials").select("slug, title, author").in("id", ids) : { data: [], error: null };
  if (books.error) throw books.error;
  const featured = new Map(books.data.map((b) => [b.slug, { slug: b.slug, title: b.title, author: b.author }]));
  for (const d of cal.days) if (d.quote) featured.set(d.quote.book.slug, { slug: d.quote.book.slug, title: d.quote.book.title, author: d.quote.book.author });

  return {
    brief: brief.body,
    today: cal.today,
    days: cal.days.map((d) => {
      const weekday = new Date(`${d.day}T00:00:00Z`).toLocaleDateString("en", { weekday: "short", timeZone: "UTC" });
      if (d.posted) return { day: d.day, weekday, status: "posted", book: d.posted.book };
      if (d.quote) return { day: d.day, weekday, status: "planned", kind: d.quote.kind, occasion: d.quote.occasion, book: d.quote.book.title };
      return { day: d.day, weekday, status: "open" };
    }),
    waiting_for_review: cal.waiting.map((q) => ({ kind: q.kind, occasion: q.occasion, day_wanted: q.wantedDay, book: q.book.title })),
    featured_recently: [...featured.values()],
    reading_lists: lists,
    note: "Plan the open days. Waiting quotes will likely fill some of them once approved; don't duplicate their occasions. Plan a reading list for each month in the window that has none (see Planning the calendar, step 8).",
  };
}

const Send = CreateSetInput;

async function send(input: z.infer<typeof Send>, origin: string) {
  const result = await createSet(input);
  if (result.setId) await logPassages(result.setId, input.title, result.saved);
  return {
    ...result,
    review: result.setId ? `${origin}/admin/passage` : null,
    message: result.setId
      ? `Saved ${result.saved} quote${result.saved === 1 ? "" : "s"}. The editor reviews them in Ominira's admin.`
      : "Nothing was saved: no quote was found word for word.",
  };
}

const ToQuote = z.object({ offset: z.int().min(0).default(0), limit: z.int().min(1).max(100).default(25) });

async function addToDirectory(input: z.infer<typeof AddQuotesInput>, origin: string) {
  const result = await addQuotes(input);
  if (result.added.length) await logQuotes(result.added);
  const total = result.added.reduce((n, b) => n + b.added, 0);
  return {
    ...result,
    directory: `${origin}/quotes`,
    message: `Added ${total} quote${total === 1 ? "" : "s"}.${result.unknownTopics.length ? " Topics not in the library were dropped: use names from categories." : ""}`,
  };
}

const ToWrite = z.object({
  offset: z.int().min(0).default(0),
  limit: z.int().min(1).max(100).default(25),
  redo: z.boolean().default(false).describe("List authors already drafted or approved instead, to revise them."),
});

async function draftAuthor(input: z.infer<typeof WriteAuthorInput>, origin: string) {
  const result = await writeAuthor(input);
  if (typeof result === "string") throw new ToolError(result);
  await logAuthor(result);
  return { ...result, review: `${origin}/admin/authors`, message: `Saved the draft of ${result.name}'s page. An editor approves it in Ominira's admin.` };
}

async function publishTopic(input: z.infer<typeof WriteTopicInput>, origin: string) {
  const result = await writeTopic(input);
  if (typeof result === "string") throw new ToolError(result);
  await logTopic(result);
  return { ...result, page: `${origin}/topics/${result.slug}`, message: `Published the ${result.name} guide.` };
}

async function draftList(input: z.infer<typeof SendReadingListInput>, origin: string) {
  const result = await sendReadingList(input);
  if (typeof result === "string") throw new ToolError(result);
  await logList(result);
  return { ...result, review: `${origin}/admin/reading-lists`, message: `Saved the draft of "${result.title}" for ${result.day}. An editor approves it in Ominira's admin; it goes live at 07:00 Lagos that day.` };
}

// ---- Registry -------------------------------------------------------------

type Tool = { description: string; input: z.ZodType; run: (input: never, origin: string) => Promise<unknown>; readOnly: boolean };

const TOOLS: Record<string, Tool> = {
  calendar: {
    description: "Call first when planning passages: the editorial brief, the next 30 days (posted, planned or open), quotes waiting for review, and books featured recently.",
    input: CalendarInput,
    run: calendar,
    readOnly: true,
  },
  catalog: { description: "List the library's public books (EPUBs and text PDFs), or filter them by a query.", input: Catalog, run: catalog, readOnly: true },
  contents: { description: "A book's chapters (EPUB) or page groups (PDF), each with its size in tokens.", input: Contents, run: contents, readOnly: true },
  read: {
    description: "Read a book's text, a chapter or a run of blocks/pages, with each block's id. Up to ~8k tokens a call; ends with a \"continue from\" marker when there's more.",
    input: Read,
    run: read,
    readOnly: true,
  },
  find: { description: "Search up to 10 books for words or phrases. Returns matching blocks, best first, with a snippet.", input: Find, run: find, readOnly: true },
  recent_passages: { description: "Recent passages of the day: quote and book. Avoid repeating them.", input: Recent, run: recentPassages, readOnly: true },
  categories: { description: "Every category, in order, with how many public books it has, plus how many books have none.", input: Categories, run: listCategories, readOnly: true },
  books_to_tag: {
    description: "Public books with their slug, title, author, year, categories and description, to tag or tidy. Untagged books only by default; pages of up to 100.",
    input: ToTag,
    run: booksToTag,
    readOnly: true,
  },
  edit_books: {
    description:
      "Fix books' details: title, author, year first published, description, and fix_slug to remake a messy slug from the title (the old link redirects). Pass only the fields to change. Up to 100 books a call. When the editor asks you to fix or tidy books, apply the fixes you are sure of without asking first; every change is kept in the Connector history.",
    input: Edit,
    run: editBooks,
    readOnly: false,
  },
  edit_categories: {
    description:
      "Rename a category, merge it into another (give an existing name), or remove it (null). Changes every book and reader's interests at once. Only call this when the editor asks.",
    input: EditCategories,
    run: editCategories,
    readOnly: false,
  },
  books_to_fix: {
    description: "Public books whose title, author, year or description show signs of a problem, each with hints; all: true lists every book. Pages of up to 100.",
    input: ToFix,
    run: booksToFix,
    readOnly: true,
  },
  tag_books: {
    description: "Set the categories of up to 100 books, replacing what each had. New categories must be listed in new_categories. Only call this when the editor asks.",
    input: Tag,
    run: tagBooks,
    readOnly: false,
  },
  books_to_quote: {
    description: "Public books whose quotes haven't been curated yet, oldest first: slug, title, author, categories. Pages of up to 100.",
    input: ToQuote,
    run: (i: z.infer<typeof ToQuote>) => booksToQuote(i),
    readOnly: true,
  },
  add_quotes: {
    description:
      "List quotes in Ominira's quote directory: up to 50 a call, each found word for word in its book, with near and one to three topics. They go live at once. Marks each book curated; pass books with nothing worth quoting in done.",
    input: AddQuotesInput,
    run: addToDirectory,
    readOnly: false,
  },
  authors_to_write: {
    description: "Authors with public books whose page has no draft yet, most books first: slug, name, their books and quote count. Pages of up to 100.",
    input: ToWrite,
    run: (i: z.infer<typeof ToWrite>) => authorsToWrite(i),
    readOnly: true,
  },
  write_author: {
    description:
      "Save a draft of an author's page: bio (80–150 words, own words, checked facts), sources, birth and death years, role, places, Wikidata item, portrait (Wikimedia Commons, with credit) and books to read alongside. An editor approves it before it shows. Replaces any earlier draft.",
    input: WriteAuthorInput,
    run: draftAuthor,
    readOnly: false,
  },
  topics_to_write: {
    description: "Every category with its number of public books and whether it has a guide, and the broad topics written so far.",
    input: z.object({}),
    run: () => topicsToWrite(),
    readOnly: true,
  },
  write_topic: {
    description:
      "Publish a topic guide (a category, or a broad topic): title, introduction (150–300 words) and the reading path, two to four stages of books with a sentence on each, about 20 books in all. It goes live at once. Replaces any earlier version of that topic's guide.",
    input: WriteTopicInput,
    run: publishTopic,
    readOnly: false,
  },
  send_reading_list: {
    description:
      "Save a draft of the month's reading list: title, publish day, the key date it's tied to (if any), introduction (100–200 words) and 6–12 books in reading order with two or three sentences on each. An editor approves it; it goes live at 07:00 Lagos on its day. Sending the same title again replaces the draft.",
    input: SendReadingListInput,
    run: draftList,
    readOnly: false,
  },
  send_to_ominira: {
    description: "Send a set of quotes to Ominira for the editor to review. Only call this when the editor asks. Quotes not found word for word are rejected with a reason; the rest save.",
    input: Send,
    run: send,
    readOnly: false,
  },
};

export function listTools() {
  return Object.entries(TOOLS).map(([name, t]) => {
    const schema = z.toJSONSchema(t.input, { io: "input" }) as Record<string, unknown>;
    delete schema.$schema;
    return { name, description: t.description, inputSchema: schema, annotations: { readOnlyHint: t.readOnly } };
  });
}

/** Runs a tool; a bad input or a ToolError comes back as the tool's error
 * text, for the AI to read and correct. */
export async function callTool(name: string, args: unknown, origin: string) {
  const tool = TOOLS[name];
  if (!tool) return { content: [{ type: "text", text: `Unknown tool "${name}".` }], isError: true };
  const parsed = tool.input.safeParse(args ?? {});
  if (!parsed.success) return { content: [{ type: "text", text: `Invalid input: ${z.prettifyError(parsed.error)}` }], isError: true };
  try {
    const out = await tool.run(parsed.data as never, origin);
    return { content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out) }] };
  } catch (err) {
    if (err instanceof ToolError) return { content: [{ type: "text", text: err.message }], isError: true };
    console.error(`[passage connector] ${name}`, err instanceof Error ? err : JSON.stringify(err));
    return { content: [{ type: "text", text: "Something went wrong on Ominira's side. Try again." }], isError: true };
  }
}

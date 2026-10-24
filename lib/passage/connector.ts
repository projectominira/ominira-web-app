import "server-only";

import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { fetchMaterialManifest } from "@/lib/materials/manifest";
import { UUID_RE } from "@/lib/materials/resolve";
import type { TocSection } from "@/lib/api/types";
import { createSet, CreateSetInput, listDays } from "./sets";
import { isScanned, loadBookText, normalise, type BookText, type TextBlock } from "./text";

// The tools the passage connector (passage-spec §6) gives an editor's AI:
// browse the library, read and search a book's text, see recent passages,
// and send a set to /admin/passage. Text comes straight from each book's
// file (lib/passage/text.ts); nothing is indexed.

const db = () => getSupabaseAdminClient();

export const INSTRUCTIONS = `You help an Ominira editor find short, quotable passages in Ominira's library of books, for sharing as images or as the passage of the day (a quote plus a question members answer).

How to work:
1. Understand the editor's idea (a theme, an anniversary, a conversation in the news).
2. Shortlist books with \`catalog\` (a query filters title, author, category and description, and shows chapter titles).
3. Use \`find\` to locate likely blocks, then \`contents\` and \`read\` to check each candidate in its context.
4. Discuss the candidates with the editor.
5. Call \`send_to_ominira\` only when the editor asks you to.

Rules:
- Quote word for word from \`read\` output. A quote that isn't found verbatim in the book is rejected.
- Keep quotes short (one to three sentences) and self-contained: they must make sense without what comes before.
- For each quote, pass \`near\` (the block id or page number \`read\` showed), say why it fits, and suggest one open question members can answer from their own life.
- Check \`recent_passages\` and avoid repeating recent quotes, books or questions.`;

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
  const { data, error } = await db()
    .from("materials")
    .select("slug, title, author, published_year, material_type, categories, description, json_storage_path")
    .eq("status", "published")
    .eq("visibility", "public")
    .in("material_type", ["book", "pdf"])
    .order("title");
  if (error) throw error;
  const books = data.map((m) => ({ ...m, categories: Array.isArray(m.categories) ? (m.categories as string[]) : [] }));
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

const Recent = z.object({ days: z.int().min(1).max(365).default(30) });

async function recentPassages({ days }: z.infer<typeof Recent>) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const out: { day: string; quote: string; book: string | null; question: string }[] = [];
  let cursor: string | null = null;
  do {
    const page = await listDays({ cursor });
    for (const d of page.items) if (d.day >= since) out.push({ day: d.day, quote: d.quote, book: d.book, question: d.question });
    cursor = page.items.at(-1)?.day && page.items.at(-1)!.day >= since ? page.nextCursor : null;
  } while (cursor);
  return { passages: out };
}

const Send = CreateSetInput;

async function send(input: z.infer<typeof Send>, origin: string) {
  const result = await createSet(input);
  return {
    ...result,
    review: result.setId ? `${origin}/admin/passage` : null,
    message: result.setId
      ? `Saved ${result.saved} quote${result.saved === 1 ? "" : "s"}. The editor reviews them in Ominira's admin.`
      : "Nothing was saved: no quote was found word for word.",
  };
}

// ---- Registry -------------------------------------------------------------

type Tool = { description: string; input: z.ZodType; run: (input: never, origin: string) => Promise<unknown>; readOnly: boolean };

const TOOLS: Record<string, Tool> = {
  catalog: { description: "List the library's public books (EPUBs and text PDFs), or filter them by a query.", input: Catalog, run: catalog, readOnly: true },
  contents: { description: "A book's chapters (EPUB) or page groups (PDF), each with its size in tokens.", input: Contents, run: contents, readOnly: true },
  read: {
    description: "Read a book's text, a chapter or a run of blocks/pages, with each block's id. Up to ~8k tokens a call; ends with a \"continue from\" marker when there's more.",
    input: Read,
    run: read,
    readOnly: true,
  },
  find: { description: "Search up to 10 books for words or phrases. Returns matching blocks, best first, with a snippet.", input: Find, run: find, readOnly: true },
  recent_passages: { description: "Recent passages of the day: quote, book and question. Avoid repeating them.", input: Recent, run: recentPassages, readOnly: true },
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

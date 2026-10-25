import "server-only";

import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { decodeCursor, encodeCursor, keysetBeforeFilter, type Keyset } from "@/lib/api/cursor";
import type { AnnotationRange } from "@/lib/api/types";
import { pdfPageIndexOf } from "@/lib/annotations/pdfSurface";
import { UUID_RE } from "@/lib/materials/resolve";
import { loadSectionLabels } from "@/lib/materials/sectionLabels";
import { RangeSchema } from "@/lib/room/events";
import { officialReaderIds, passageDay, setPassage, type PassageOutcome } from "@/lib/rooms/passage";
import { passageView } from "@/lib/rooms/homeView";
import { rangesKey } from "@/stores/library-store";
import { isScanned, loadBookText, locateQuote, MAX_QUOTE_BLOCKS, rangeText } from "./text";
import { quoteText, type ContextBlock, type DayView, type Page, type QuoteView, type SetView, type TodayView } from "./types";

// Passage sets (passage-spec §2): what an editor's AI sends in, and what
// /admin/passage does with it. Tables: migrations/20261119_passage_sets.sql.

const db = () => getSupabaseAdminClient();

const BOOK_COLUMNS = "id, slug, title, author, material_type, status, visibility, json_storage_path, source_url";

export const CreateSetInput = z.object({
  title: z.string().trim().min(1).max(120),
  note: z.string().trim().max(2000).default(""),
  quotes: z
    .array(
      z.object({
        /** A material slug or id. */
        book: z.string().trim().min(1).max(200),
        quote: z.string().trim().min(1).max(5000),
        /** Where to look first: a block id, or a PDF page number. */
        near: z.union([z.string().max(200), z.int().positive()]).optional(),
        why: z.string().trim().max(2000).default(""),
        question: z.string().trim().max(280).default(""),
      })
    )
    .min(1)
    .max(30),
});
export type CreateSetInput = z.input<typeof CreateSetInput>;

export type CreateSetResult = { setId: string | null; saved: number; rejected: { quote: string; reason: string }[] };

/**
 * The one way a set comes in, for the sample script and the connector. Each
 * quote is found word for word in its book (lib/passage/text.ts); one that
 * can't be is reported with a reason, and the rest still save. A set with
 * nothing found isn't saved.
 */
export async function createSet(raw: CreateSetInput): Promise<CreateSetResult> {
  const input = CreateSetInput.parse(raw);
  const keys = [...new Set(input.quotes.map((q) => q.book))];
  const ids = keys.filter((k) => UUID_RE.test(k));
  const slugs = keys.filter((k) => !UUID_RE.test(k));
  const [byId, bySlug] = await Promise.all([
    ids.length ? db().from("materials").select(BOOK_COLUMNS).in("id", ids) : { data: [], error: null },
    slugs.length ? db().from("materials").select(BOOK_COLUMNS).in("slug", slugs) : { data: [], error: null },
  ]);
  if (byId.error) throw byId.error;
  if (bySlug.error) throw bySlug.error;
  const books = new Map([...byId.data, ...bySlug.data].flatMap((m) => [[m.id, m] as const, [m.slug, m] as const]));

  const found = await Promise.all(
    input.quotes.map(async (q) => {
      const book = books.get(q.book);
      if (!book || book.status !== "published" || book.visibility !== "public") return "No public, published book by that slug or id.";
      const load = loadBookText(book);
      if (!load) return "Only EPUBs and text PDFs can be quoted.";
      try {
        const text = await load;
        if (isScanned(text)) return "This PDF is a scan: it has no text to quote.";
        const located = locateQuote(text, q.quote, q.near);
        return typeof located === "string" ? located : { materialId: book.id, ...located };
      } catch (err) {
        return err instanceof Error ? err.message : "The book's text couldn't be read.";
      }
    })
  );

  const rejected: CreateSetResult["rejected"] = [];
  const saved = input.quotes.flatMap((q, i) => {
    const f = found[i];
    if (typeof f !== "string") return [{ q, f }];
    rejected.push({ quote: q.quote, reason: f });
    return [];
  });
  if (saved.length === 0) return { setId: null, saved: 0, rejected };

  const { data: set, error } = await db().from("passage_sets").insert({ title: input.title, note: input.note }).select("id").single();
  if (error) throw error;
  const { error: quotesError } = await db()
    .from("passage_quotes")
    .insert(
      saved.map(({ q, f }, position) => ({
        set_id: set.id,
        position,
        material_id: f.materialId,
        ranges: f.ranges,
        picked_ranges: f.ranges,
        context: f.context,
        why: q.why,
        question: q.question,
      }))
    );
  if (quotesError) throw quotesError;
  return { setId: set.id, saved: saved.length, rejected };
}

// ---- Reading --------------------------------------------------------------

const SETS_PAGE = 10;
const DAYS_PAGE = 20;

type QuoteRow = {
  id: string;
  set_id: string;
  material_id: string;
  ranges: unknown;
  picked_ranges: unknown;
  context: unknown;
  why: string;
  question: string;
  status: QuoteView["status"];
  post_id: string | null;
};

/** The latest day each quote was the passage: its own note's, or any of the
 * Ominira account's notes on the same words. */
async function usedDays(quotes: QuoteRow[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (quotes.length === 0) return out;
  const official = [...(await officialReaderIds())];
  const { data: posts, error } = official.length
    ? await db()
        .from("posts")
        .select("id, material_id, ranges")
        .in("material_id", [...new Set(quotes.map((q) => q.material_id))])
        .in("reader_id", official)
        .is("parent_id", null)
    : { data: [], error: null };
  if (error) throw error;
  const postIds = [...new Set([...posts.map((p) => p.id), ...quotes.flatMap((q) => (q.post_id ? [q.post_id] : []))])];
  if (postIds.length === 0) return out;
  const { data: days, error: daysError } = await db().from("daily_passages").select("day, post_id").in("post_id", postIds);
  if (daysError) throw daysError;
  const dayOf = new Map(days.map((d) => [d.post_id, d.day]));
  const byWords = new Map<string, string>();
  for (const p of posts) {
    const day = dayOf.get(p.id);
    const key = `${p.material_id}|${rangesKey((p.ranges ?? []) as AnnotationRange[])}`;
    if (day && day > (byWords.get(key) ?? "")) byWords.set(key, day);
  }
  for (const q of quotes) {
    const own = (q.post_id && dayOf.get(q.post_id)) || "";
    const same = byWords.get(`${q.material_id}|${rangesKey(q.ranges as AnnotationRange[])}`) ?? "";
    const day = own > same ? own : same;
    if (day) out.set(q.id, day);
  }
  return out;
}

/** Sets newest first, each with its quotes in order. */
export async function listSets({ cursor }: { cursor: string | null }): Promise<Page<SetView>> {
  let query = db().from("passage_sets").select("id, title, note, created_at").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(SETS_PAGE + 1);
  const after = decodeCursor<Keyset>(cursor);
  if (after) query = query.or(keysetBeforeFilter(after));
  const { data: rows, error } = await query;
  if (error) throw error;
  const sets = rows.slice(0, SETS_PAGE);
  const last = sets.at(-1);
  const nextCursor = rows.length > SETS_PAGE && last ? encodeCursor<Keyset>({ createdAt: last.created_at, id: last.id }) : null;
  if (sets.length === 0) return { items: [], nextCursor };

  const { data: quotes, error: quotesError } = await db()
    .from("passage_quotes")
    .select("id, set_id, material_id, ranges, picked_ranges, context, why, question, status, post_id")
    .in("set_id", sets.map((s) => s.id))
    .order("position");
  if (quotesError) throw quotesError;
  const [materials, used] = await Promise.all([
    db().from("materials").select("id, slug, title, author, material_type, json_storage_path").in("id", [...new Set(quotes.map((q) => q.material_id))]),
    usedDays(quotes),
  ]);
  if (materials.error) throw materials.error;
  const labels = await loadSectionLabels(materials.data);
  const books = new Map(materials.data.map((m) => [m.id, m]));

  const bySet = new Map<string, QuoteView[]>();
  for (const q of quotes) {
    const m = books.get(q.material_id);
    if (!m) continue;
    const ranges = q.ranges as AnnotationRange[];
    const first = ranges[0]?.passageId ?? "";
    const page = pdfPageIndexOf(first);
    const section = first.match(/^(.+)-p\d+$/)?.[1];
    const list = bySet.get(q.set_id) ?? [];
    list.push({
      id: q.id,
      status: q.status,
      ranges,
      picked: q.picked_ranges as AnnotationRange[],
      context: q.context as ContextBlock[],
      why: q.why,
      question: q.question,
      book: { id: m.id, slug: m.slug, title: m.title, author: m.author, materialType: m.material_type },
      chapter: (section && labels.get(m.id)?.get(section)) || null,
      page: page >= 0 ? page + 1 : null,
      usedOn: used.get(q.id) ?? null,
    });
    bySet.set(q.set_id, list);
  }
  return {
    items: sets.map((s) => ({ id: s.id, title: s.title, note: s.note, createdAt: s.created_at, quotes: bySet.get(s.id) ?? [] })),
    nextCursor,
  };
}

/** Quotes not yet used or dismissed, across every set. */
export async function countNewQuotes(): Promise<number> {
  const { count, error } = await db().from("passage_quotes").select("id", { count: "exact", head: true }).eq("status", "new");
  if (error) throw error;
  return count ?? 0;
}

/** Who a passage notifies: every reader but the Ominira account. */
export async function countMembers(): Promise<number> {
  const { count, error } = await db().from("readers").select("id", { count: "exact", head: true }).eq("official", false);
  if (error) throw error;
  return count ?? 0;
}

async function pseudonyms(ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  if (wanted.length === 0) return new Map();
  const { data, error } = await db().from("readers").select("id, pseudonym").in("id", wanted);
  if (error) throw error;
  return new Map(data.map((r) => [r.id, r.pseudonym]));
}

/** Today's passage as members see it, and who set it when. */
export async function getToday(): Promise<TodayView> {
  const { data: day, error } = await db().from("daily_passages").select("post_id, question, set_by, created_at").eq("day", passageDay(Date.now())).maybeSingle();
  if (error) throw error;
  if (!day) return null;
  const [passage, names] = await Promise.all([passageView(day), pseudonyms([day.set_by])]);
  return passage && { passage, postId: day.post_id, setBy: (day.set_by && names.get(day.set_by)) || null, at: day.created_at };
}

/** Every day's passage, newest first. */
export async function listDays({ cursor }: { cursor: string | null }): Promise<Page<DayView>> {
  let query = db().from("daily_passages").select("day, post_id, question, set_by").order("day", { ascending: false }).limit(DAYS_PAGE + 1);
  const before = decodeCursor<{ day: string }>(cursor);
  if (before) query = query.lt("day", before.day);
  const { data: rows, error } = await query;
  if (error) throw error;
  const days = rows.slice(0, DAYS_PAGE);
  const last = days.at(-1);
  const nextCursor = rows.length > DAYS_PAGE && last ? encodeCursor({ day: last.day }) : null;
  if (days.length === 0) return { items: [], nextCursor };

  const postIds = days.map((d) => d.post_id);
  const [posts, replies, quotes, names] = await Promise.all([
    db().from("posts").select("id, material_id, ranges").in("id", postIds),
    db().from("posts").select("parent_id").in("parent_id", postIds).eq("visibility", "public"),
    db().from("passage_quotes").select("post_id, set_id").in("post_id", postIds),
    pseudonyms(days.map((d) => d.set_by)),
  ]);
  if (posts.error) throw posts.error;
  if (replies.error) throw replies.error;
  if (quotes.error) throw quotes.error;
  const materialIds = [...new Set(posts.data.flatMap((p) => (p.material_id ? [p.material_id] : [])))];
  const setIds = [...new Set(quotes.data.map((q) => q.set_id))];
  const [materials, sets] = await Promise.all([
    materialIds.length ? db().from("materials").select("id, title").in("id", materialIds) : { data: [], error: null },
    setIds.length ? db().from("passage_sets").select("id, title").in("id", setIds) : { data: [], error: null },
  ]);
  if (materials.error) throw materials.error;
  if (sets.error) throw sets.error;

  const postById = new Map(posts.data.map((p) => [p.id, p]));
  const titles = new Map(materials.data.map((m) => [m.id, m.title]));
  const setTitles = new Map(sets.data.map((s) => [s.id, s.title]));
  const setOf = new Map(quotes.data.map((q) => [q.post_id, setTitles.get(q.set_id) ?? null]));
  const answers = new Map<string, number>();
  for (const r of replies.data) if (r.parent_id) answers.set(r.parent_id, (answers.get(r.parent_id) ?? 0) + 1);

  return {
    items: days.map((d) => {
      const post = postById.get(d.post_id);
      return {
        day: d.day,
        postId: d.post_id,
        question: d.question,
        quote: quoteText((post?.ranges ?? []) as AnnotationRange[]),
        book: (post?.material_id && titles.get(post.material_id)) || null,
        answers: answers.get(d.post_id) ?? 0,
        setBy: (d.set_by && names.get(d.set_by)) || null,
        fromSet: setOf.get(d.post_id) ?? null,
      };
    }),
    nextCursor,
  };
}

// ---- Changing -------------------------------------------------------------

async function quoteRow(id: string) {
  const { data, error } = await db().from("passage_quotes").select("id, material_id, ranges, context, status").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export const TrimRanges = z.array(RangeSchema).min(1).max(MAX_QUOTE_BLOCKS);

/**
 * Sets the quote to new words within its context: one range per block, in
 * order, over consecutive blocks, each inner block whole. The words are
 * taken from the context, not the request.
 */
export async function trimQuote(id: string, ranges: AnnotationRange[]): Promise<AnnotationRange[] | "not_found" | "invalid"> {
  const row = await quoteRow(id);
  if (!row) return "not_found";
  const context = row.context as ContextBlock[];
  const at = ranges.map((r) => context.findIndex((b) => b.passageId === r.passageId));
  const valid = ranges.every((r, i) => {
    const block = context[at[i]];
    if (!block || r.start >= r.end || r.end > block.text.length) return false;
    if (i > 0 && (at[i] !== at[i - 1] + 1 || r.start !== 0)) return false;
    return i === ranges.length - 1 || r.end === block.text.length;
  });
  if (!valid) return "invalid";
  const saved = ranges
    .map((r, i) => ({ passageId: r.passageId, start: r.start, end: r.end, text: rangeText(r.passageId, context[at[i]].text, r.start, r.end) }))
    .filter((r) => r.text.trim());
  if (saved.length === 0) return "invalid";
  const { error } = await db().from("passage_quotes").update({ ranges: saved }).eq("id", id);
  if (error) throw error;
  return saved;
}

export async function setQuestion(id: string, question: string): Promise<boolean> {
  const { data, error } = await db().from("passage_quotes").update({ question }).eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  return !!data;
}

/** Dismisses a quote, or restores it (back to new). */
export async function setStatus(id: string, status: "new" | "dismissed"): Promise<boolean> {
  const { data, error } = await db().from("passage_quotes").update({ status }).eq("id", id).neq("status", "used").select("id").maybeSingle();
  if (error) throw error;
  return !!data;
}

/** Makes the quote today's passage (setPassage: posts, replaces today's,
 * notifies), then marks it used with its note. */
export async function setTodayFromQuote(id: string, question: string, setBy: string | null): Promise<PassageOutcome | "not_found"> {
  const row = await quoteRow(id);
  if (!row) return "not_found";
  const outcome = await setPassage({ materialId: row.material_id, ranges: row.ranges as AnnotationRange[], text: "", question }, setBy);
  if (typeof outcome === "string") return outcome;
  const { error } = await db().from("passage_quotes").update({ status: "used", post_id: outcome.postId, question }).eq("id", id);
  if (error) throw error;
  return outcome;
}

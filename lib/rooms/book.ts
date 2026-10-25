// A book room's header (rooms-spec §2 Book room, sheet #c7, 6a / 10a): the
// book's facts, the viewer's progress and who's reading now, in the words
// the header shows. Pure.

import type { CurrentReaderSummary } from "@/lib/api/types";
import type { ChapterEnd } from "@/lib/groups/progress";
import { chapterLine } from "./home";
import type { BookRoomHeader } from "./types";

/** The viewer's place in the book; null before they've opened it. */
export type BookProgress = { pct: number; finished: boolean; listening: boolean } | null;

export type BookFacts = {
  title: string;
  /** "book", "pdf", "docx": named in the facts line (FORMAT). */
  materialType: string;
  author: string;
  cover: string | null;
  description: string;
  publishedYear: number | null;
  pageCountEstimate: number | null;
  narratorCount: number;
  noteCount: number;
  /** Active in the last 15 minutes (READING_NOW_MS). */
  readers: CurrentReaderSummary[];
  readerCount: number;
};

/** A material's format in plain words; an unknown type is left out. */
const FORMAT: Record<string, string> = { book: "EPUB", pdf: "PDF", docx: "Word document" };

/** The primary button: one resume action in the mode last used. */
export function bookCta(p: BookProgress): string {
  if (p?.finished) return p.listening ? "Listen again" : "Read again";
  if (p?.listening) return "Continue listening";
  return p && p.pct > 0 ? "Continue reading" : "Start reading";
}

/** How far through each chapter the viewer is, 0–100; null before it. */
export function chapterProgress(ends: ChapterEnd[], p: BookProgress): (number | null)[] {
  return ends.map((end, i) => {
    if (p?.finished) return 100;
    const start = i ? ends[i - 1].endPct : 0;
    const pct = p?.pct ?? 0;
    if (pct >= end.endPct) return 100;
    if (pct <= start) return null;
    return Math.round(((pct - start) / (end.endPct - start)) * 100);
  });
}

export function bookHeader(book: BookFacts, p: BookProgress, ends: ChapterEnd[]): BookRoomHeader {
  const started = p && (p.finished || p.pct > 0) ? p : null;
  const pcts = chapterProgress(ends, p);
  return {
    title: book.title,
    author: book.author,
    cover: book.cover,
    pct: started && (started.finished ? 100 : Math.round(started.pct)),
    chapter: started && !started.finished ? chapterLine(ends, started.pct) : null,
    cta: bookCta(p),
    listening: !!p?.listening,
    noteCount: book.noteCount,
    everyone: book.readers.map((r) => ({ comrade: { readerId: r.readerId, pseudonym: r.pseudonym, avatar: r.avatar } })),
    everyoneCount: book.readerCount,
    description: book.description,
    meta: [FORMAT[book.materialType], book.publishedYear, book.pageCountEstimate && `${book.pageCountEstimate} pages`, book.narratorCount > 0 && "Audiobook"].filter(Boolean).join(" · "),
    contents: ends.map((end, i) => ({ num: String(i + 1), label: end.label, pct: pcts[i], id: end.id })),
  };
}

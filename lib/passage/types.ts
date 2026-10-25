import type { AnnotationRange } from "@/lib/api/types";
import type { HomePassage } from "@/lib/rooms/types";

// What /admin/passage shows (passage-spec §3), shared by lib/passage/sets.ts
// and the page.

export type QuoteStatus = "new" | "used" | "dismissed";

/** A quoted block and the ones either side: what trimming can reach. */
export type ContextBlock = { passageId: string; text: string };

export type QuoteView = {
  id: string;
  status: QuoteStatus;
  ranges: AnnotationRange[];
  /** The AI's pick, for Reset. */
  picked: AnnotationRange[];
  context: ContextBlock[];
  why: string;
  question: string;
  book: { id: string; slug: string; title: string; author: string; materialType: string };
  /** The chapter, for an EPUB. */
  chapter: string | null;
  /** The page (1-based), for a PDF. */
  page: number | null;
  /** The latest day this quote (its note, or the same words) was the passage. */
  usedOn: string | null;
};

export type SetView = { id: string; title: string; note: string; createdAt: string; quotes: QuoteView[] };

export type DayView = {
  day: string;
  postId: string;
  question: string;
  quote: string;
  book: string | null;
  answers: number;
  setBy: string | null;
  fromSet: string | null;
};

export type TodayView = { passage: HomePassage; postId: string; setBy: string | null; at: string } | null;

export type Page<T> = { items: T[]; nextCursor: string | null };

/** A quote's words: its ranges' own text, as the reader quotes them (quoteForRanges). */
export const quoteText = (ranges: AnnotationRange[]) => ranges.map((r) => r.text ?? "").join(" … ");

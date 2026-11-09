import type { AnnotationRange } from "@/lib/api/types";
import type { PassageKind, PassageQuoteStatus } from "@/lib/supabase/database.types";
import type { HomePassage } from "@/lib/rooms/types";

// What /admin/passage shows (passage-spec §3), shared by lib/passage/sets.ts
// and the page.

export type QuoteStatus = PassageQuoteStatus;
export type { PassageKind };

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
  kind: PassageKind;
  /** Why this, today: admin only. */
  occasion: string;
  /** The AI's date, for an anniversary. */
  wantedDay: string | null;
  /** Its day once approved. */
  day: string | null;
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

/** One day of the next 30 (passage-spec §8.4): today's posted passage, or
 * the quote approved for it, or neither (open). */
export type CalendarDay = { day: string; posted: DayView | null; quote: QuoteView | null };

export type CalendarView = {
  /** Today in Lagos: the first of `days`. */
  today: string;
  days: CalendarDay[];
  /** Quotes waiting for review, newest first (what Fill offers). */
  waiting: QuoteView[];
};

export type TodayView = { passage: HomePassage; postId: string; setBy: string | null; at: string } | null;

export type Page<T> = { items: T[]; nextCursor: string | null };

/** A quote's words: its ranges' own text, as the reader quotes them (quoteForRanges). */
export const quoteText = (ranges: AnnotationRange[]) => ranges.map((r) => r.text ?? "").join(" … ");

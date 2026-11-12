import "server-only";

import type { Metadata } from "next";
import type { DirectoryView } from "@/app/components/quotes/QuotesDirectory";
import { PLATFORM_URL } from "@/lib/config/platform";
import { listQuotes, quoteFacets, todayQuote } from "./directory";

// What the three /quotes routes share (seo-spec.md C4).

export type DirectoryParams = { q?: string; page?: string };

export const pageNumber = (page?: string) => Math.max(1, Math.min(1000, Number.parseInt(page ?? "1", 10) || 1));

/** Loads one view of the directory. */
export async function directoryView(
  base: { path: string; heading: string; intro: string; crumb: string | null; topic?: string | null; authorId?: string | null },
  params: DirectoryParams
): Promise<DirectoryView> {
  const query = (params.q ?? "").trim().slice(0, 100);
  const page = pageNumber(params.page);
  const featured = base.path === "/quotes" && !query && page === 1;
  const [{ quotes, more }, { topics, authors }, today] = await Promise.all([
    listQuotes({ q: query, topic: base.topic, authorId: base.authorId, page }),
    quoteFacets(),
    featured ? todayQuote() : null,
  ]);
  // Today's passage is the featured card; not again in the list.
  const listed = today ? quotes.filter((q) => q.text !== today.excerpt) : quotes;
  return { ...base, topic: base.topic ?? null, query, page, quotes: listed, more, topics, authors, today };
}

/** Title, description and canonical; a search is noindex (one page per intent). */
export function directoryMetadata(path: string, title: string, description: string, params: DirectoryParams): Metadata {
  const page = pageNumber(params.page);
  const url = `${PLATFORM_URL}${path}${page > 1 ? `?page=${page}` : ""}`;
  return {
    title: page > 1 ? `${title} (page ${page})` : title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
    ...(params.q?.trim() && { robots: { index: false, follow: true } }),
  };
}

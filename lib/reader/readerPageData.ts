import type { Metadata } from "next";
import { resolveMaterialRow } from "@/lib/materials/resolve";
import { PLATFORM_NAME } from "@/lib/config/platform";
import { missingBook } from "@/lib/materials/oldSlug";
import { loadReaderMaterial, MaterialNotFoundError, type ReaderMaterial } from "./loadReaderMaterial";

/**
 * Shared server-side load for the two routes that render the real,
 * standalone reader page — app/read/[slug] (the canonical/shareable URL)
 * and app/reader/[slug] (the soft-navigable entry point ReaderLink points
 * at, so the root layout's <audio> element never unmounts crossing into
 * it). Both render the exact same <BookReader> with the exact same prop set,
 * so sharing this is a real de-dup, not forced abstraction — unlike
 * app/@modal/(.)read/[slug]/page.tsx, which renders <ReaderModal> with a
 * narrower prop set and stays deliberately separate (see its own doc
 * comment).
 */

/** A renamed book's old reader links land on its reader under the new slug. */
const readerPath = (slug: string) => `/reader/${slug}`;

// The row alone: a <title>/description tag never needs the manifest, the
// current readers or the book's text.
export async function readerPageMetadata(slug: string): Promise<Metadata> {
  const row = await resolveMaterialRow(slug);
  if (!row) return missingBook(slug, readerPath);
  const { title, author, description } = row;
  const desc = description || `${title} by ${author} — read or listen on ${PLATFORM_NAME}.`;
  // The book's page (/library/<slug>) is the search result; reader URLs had
  // been showing up in Google (seo-spec.md T1). noindex rather than a
  // canonical: Google skips rendering a noindex page, so it never pulls the
  // book's text from the CDN.
  return { title, description: desc, robots: { index: false, follow: true } };
}

export async function loadReaderPageMaterial(slug: string): Promise<ReaderMaterial> {
  try {
    return await loadReaderMaterial(slug);
  } catch (err) {
    if (err instanceof MaterialNotFoundError) return missingBook(slug, readerPath);
    // Anything unexpected surfaces through error.tsx
    throw err;
  }
}

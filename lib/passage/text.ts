import "server-only";

import type { WrappedPdfiumModule } from "@embedpdf/pdfium";
import { pdfBlockId, readableQuote } from "@/lib/annotations/pdfSurface";
import { parseBookDocument, type Section } from "@/lib/book/schema";
import { sectionLabel } from "@/lib/reader/sectionHeading";
import { cdnUrl, fetchStorageText } from "@/lib/storage/r2";
import type { AnnotationRange } from "@/lib/api/types";

// A book's text as the reader addresses it (passage-spec §6.3), for locating
// quotes: an EPUB's passages from its book.json, or a PDF's pages as PDFium
// reads them — the engine the reader uses, so `pdf:p<n>` offsets match the
// reader's exactly. Nothing is indexed or stored; a book's text is held in
// memory while the instance stays warm.

/** One block a range can point into: an EPUB passage or a PDF page. */
export type TextBlock = { id: string; text: string; label: string };

export type BookText = {
  kind: "book" | "pdf";
  blocks: TextBlock[];
  /** Every block's text, normalised (`normalise`) and joined by a space, for
   * searching; `blockAt`/`offsetAt` lead each of its characters back to a
   * block and an offset in that block's own text. */
  search: string;
  blockAt: Int32Array;
  offsetAt: Int32Array;
};

export type TextMaterial = { id: string; material_type: string; json_storage_path: string | null; source_url: string | null };

/** At most 5 blocks per quote, as setPassage takes. */
export const MAX_QUOTE_BLOCKS = 5;

// ---- Normalising ----------------------------------------------------------

/** PDFium's invisible markers, which the reader strips from a page's text
 * (@embedpdf/models' stripPdfUnwantedMarkers). */
const PDF_MARKERS = /[­​⁠﻿￾￿]/;
const FOLD: Record<string, string> = { "‘": "'", "’": "'", "“": '"', "”": '"' };

/**
 * Word-for-word comparison form: whitespace runs become one space and curly
 * quotes straight ones. On a PDF, markers are dropped and a word hyphenated
 * across a line is joined. `emit` gets each kept character with its offset in
 * `text`.
 */
function normaliseInto(text: string, pdf: boolean, emit: (ch: string, offset: number) => void, lastWasSpace: boolean): boolean {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (pdf && PDF_MARKERS.test(ch)) continue;
    if (pdf && ch === "-" && /^-\r?\n/.test(text.slice(i, i + 3))) {
      // Skip the hyphen and the line break after it.
      while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
      continue;
    }
    if (/\s/.test(ch)) {
      if (!lastWasSpace) emit(" ", i);
      lastWasSpace = true;
      continue;
    }
    emit(FOLD[ch] ?? ch, i);
    lastWasSpace = false;
  }
  return lastWasSpace;
}

export function normalise(text: string, pdf = false): string {
  let out = "";
  normaliseInto(text, pdf, (ch) => (out += ch), true);
  return out.trim();
}

function indexBlocks(kind: BookText["kind"], blocks: TextBlock[]): BookText {
  const chars: string[] = [];
  const blockAt: number[] = [];
  const offsetAt: number[] = [];
  let space = true;
  blocks.forEach((block, b) => {
    if (!space) {
      chars.push(" ");
      blockAt.push(b);
      offsetAt.push(0);
      space = true;
    }
    space = normaliseInto(
      block.text,
      kind === "pdf",
      (ch, offset) => {
        chars.push(ch);
        blockAt.push(b);
        offsetAt.push(offset);
      },
      space
    );
  });
  return { kind, blocks, search: chars.join(""), blockAt: Int32Array.from(blockAt), offsetAt: Int32Array.from(offsetAt) };
}

// ---- Loading --------------------------------------------------------------

function epubBlocks(sections: Section[], out: TextBlock[] = [], label = ""): TextBlock[] {
  for (const section of sections) {
    const here = sectionLabel(section) ?? label;
    for (const p of section.passages) if (p.text.trim()) out.push({ id: p.id, text: p.text, label: here });
    epubBlocks(section.children, out, here);
  }
  return out;
}

async function loadEpub(jsonKey: string): Promise<TextBlock[]> {
  const parsed = parseBookDocument(JSON.parse(await fetchStorageText(jsonKey)));
  if (!parsed.ok) throw new Error(`Invalid book JSON at ${jsonKey}`);
  return epubBlocks(parsed.data.sections);
}

let pdfium: Promise<WrappedPdfiumModule> | null = null;

function pdfiumModule() {
  pdfium ??= (async () => {
    // Loaded on first use only: most callers never open a PDF. In Node the
    // package finds its own pdfium.wasm beside it (it's a server external,
    // next.config.ts).
    const { init } = await import("@embedpdf/pdfium");
    const lib = await init({});
    lib.PDFiumExt_Init();
    return lib;
  })();
  pdfium.catch(() => (pdfium = null));
  return pdfium;
}

/** Each page's whole text, as PDFium gives it (offsets are its character
 * indexes, which is what the reader's `pdf:p<n>` ranges count). */
async function loadPdf(sourceUrl: string): Promise<TextBlock[]> {
  const res = await fetch(cdnUrl(sourceUrl));
  if (!res.ok) throw new Error(`Could not fetch ${sourceUrl} (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const m = await pdfiumModule();
  const { pdfium: mod } = m;
  const filePtr = mod.wasmExports.malloc(bytes.length);
  // The Emscripten heap; the package's types leave it out.
  (mod as unknown as { HEAPU8: Uint8Array }).HEAPU8.set(bytes, filePtr);
  const doc = m.FPDF_LoadMemDocument(filePtr, bytes.length, "");
  try {
    if (!doc) throw new Error(`PDFium could not open ${sourceUrl} (${m.FPDF_GetLastError()})`);
    const blocks: TextBlock[] = [];
    for (let i = 0, n = m.FPDF_GetPageCount(doc); i < n; i++) {
      const page = m.FPDF_LoadPage(doc, i);
      const textPage = m.FPDFText_LoadPage(page);
      const count = m.FPDFText_CountChars(textPage);
      let text = "";
      if (count > 0) {
        const buf = mod.wasmExports.malloc((count + 1) * 2);
        m.FPDFText_GetText(textPage, 0, count, buf);
        text = mod.UTF16ToString(buf);
        mod.wasmExports.free(buf);
      }
      m.FPDFText_ClosePage(textPage);
      m.FPDF_ClosePage(page);
      blocks.push({ id: pdfBlockId(i), text, label: `p. ${i + 1}` });
    }
    return blocks;
  } finally {
    if (doc) m.FPDF_CloseDocument(doc);
    mod.wasmExports.free(filePtr);
  }
}

/** Below this many letters a PDF page counts as having no text (a scan, a
 * plate); a PDF made mostly of those is a scan, and is left out. */
const MIN_PAGE_LETTERS = 40;

export function isScanned(text: BookText): boolean {
  if (text.kind !== "pdf") return false;
  const empty = text.blocks.filter((b) => (b.text.match(/\p{L}/gu)?.length ?? 0) < MIN_PAGE_LETTERS).length;
  return empty > text.blocks.length / 2;
}

/** Books held at once; the oldest goes first. */
const CACHE_MAX = 8;
const cache = new Map<string, Promise<BookText>>();

/** An EPUB's (`book`) or PDF's text; null for any other kind of material. */
export function loadBookText(material: TextMaterial): Promise<BookText> | null {
  const kind = material.material_type === "book" ? "book" : material.material_type === "pdf" ? "pdf" : null;
  if (!kind) return null;
  const hit = cache.get(material.id);
  if (hit) {
    cache.delete(material.id);
    cache.set(material.id, hit);
    return hit;
  }
  const load = (async () => {
    if (kind === "book") {
      if (!material.json_storage_path) throw new Error("This book has no text yet.");
      return indexBlocks(kind, await loadEpub(material.json_storage_path));
    }
    if (!material.source_url) throw new Error("This PDF has no file.");
    return indexBlocks(kind, await loadPdf(material.source_url));
  })();
  load.catch(() => cache.delete(material.id));
  cache.set(material.id, load);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return load;
}

// ---- Quotes ---------------------------------------------------------------

/** A range's own words, as the reader saves them (lib/annotations): a PDF
 * page's slice made readable, an EPUB passage's slice as it is. */
export function rangeText(passageId: string, blockText: string, start: number, end: number): string {
  const slice = blockText.slice(start, end);
  return passageId.startsWith("pdf:p") ? readableQuote(slice.replace(new RegExp(PDF_MARKERS.source, "g"), "")) : slice;
}

/** The ranges covering blocks[from].text[start] .. blocks[to].text[end), one
 * per block, each with its words. */
export function rangesBetween(blocks: TextBlock[], from: number, start: number, to: number, end: number): AnnotationRange[] {
  const ranges: AnnotationRange[] = [];
  for (let b = from; b <= to; b++) {
    const { id, text } = blocks[b];
    const s = b === from ? start : 0;
    const e = b === to ? end : text.length;
    const words = rangeText(id, text, s, e);
    if (e > s && words.trim()) ranges.push({ passageId: id, start: s, end: e, text: words });
  }
  return ranges;
}

export type Located = { ranges: AnnotationRange[]; context: { passageId: string; text: string }[] };

/**
 * Finds a quote word for word (`normalise`d). With `near` (a block id, or a
 * PDF page number), the match closest to it wins; otherwise the first. The
 * context is the quoted blocks and one either side.
 */
export function locateQuote(book: BookText, quote: string, near?: string | number): Located | string {
  const needle = normalise(quote, book.kind === "pdf");
  if (!needle) return "The quote is empty.";
  const nearIndex = near === undefined ? -1 : book.blocks.findIndex((b) => b.id === (typeof near === "number" ? pdfBlockId(near - 1) : near));

  let best = -1;
  for (let at = book.search.indexOf(needle); at >= 0; at = book.search.indexOf(needle, at + 1)) {
    if (nearIndex < 0) {
      best = at;
      break;
    }
    if (best < 0 || Math.abs(book.blockAt[at] - nearIndex) < Math.abs(book.blockAt[best] - nearIndex)) best = at;
  }
  if (best < 0) return "Not found word for word in this book.";

  const last = best + needle.length - 1;
  const from = book.blockAt[best];
  const to = book.blockAt[last];
  if (to - from + 1 > MAX_QUOTE_BLOCKS) return `Spans more than ${MAX_QUOTE_BLOCKS} paragraphs or pages.`;
  const ranges = rangesBetween(book.blocks, from, book.offsetAt[best], to, book.offsetAt[last] + 1);
  const context = book.blocks.slice(Math.max(0, from - 1), to + 2).map((b) => ({ passageId: b.id, text: b.text }));
  return { ranges, context };
}

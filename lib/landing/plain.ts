import "server-only";

import { unstable_cache } from "next/cache";
import sharp from "sharp";

// A plain cover: a scanned title page (mostly light, colourless paper) or a
// near-blank image. The landing leaves these out (its covers are the show).
// Measured once per image URL and kept (a cover's file never changes in
// place; a new cover is a new URL).

/** Share of light, neutral pixels that makes a title page. Designed white
 * covers sit at 0.83 and under; title pages at 0.85 and over. */
const PAPER = 0.85;

async function measure(url: string): Promise<boolean> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`cover ${res.status}`);
  const img = sharp(Buffer.from(await res.arrayBuffer())).removeAlpha();
  const [{ entropy }, { data }] = await Promise.all([img.clone().stats(), img.resize(24, 36, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true })]);
  if (entropy < 1) return true;
  let paper = 0;
  for (let p = 0; p < data.length; p += 3) {
    const max = Math.max(data[p], data[p + 1], data[p + 2]);
    const min = Math.min(data[p], data[p + 1], data[p + 2]);
    if (min > 185 && max - min < 28) paper++;
  }
  return paper / (data.length / 3) >= PAPER;
}

/** Throws when the image can't be read (not cached; try again later). */
export const isPlainCover = unstable_cache(measure,
  ["landing-plain-cover-v1"],
  { revalidate: false }
);

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Share-card size X, WhatsApp and Facebook all show uncropped (1.91:1). */
export const OG_SIZE = { width: 1200, height: 630 };

/** The wordmark's rust, for the domain line under it. */
export const OG_ACCENT = "#C34E1F";

/** A public/icons PNG as a data URL, for next/og ImageResponse. */
export async function brandImage(name: string) {
  const data = await readFile(join(process.cwd(), "public/icons", name));
  return `data:image/png;base64,${data.toString("base64")}`;
}

/** The cover as a data URL, or null if it's missing or a format next/og can't draw. */
export async function loadCover(url: string | null) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(jpeg|png)/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

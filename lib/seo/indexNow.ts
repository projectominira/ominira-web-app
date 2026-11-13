import { PLATFORM_URL } from "@/lib/config/platform";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";

// IndexNow (seo-spec.md T10): tells Bing (whose index feeds ChatGPT search
// and DuckDuckGo), Yandex and Seznam about new and changed pages within
// minutes, instead of waiting for them to re-read the sitemap: books, author
// pages, topic guides and reading lists.
//
// Run from the 5-minute cron: it sends the public pages changed in the last
// WINDOW. The windows overlap, so a missed run loses nothing, and a repeat
// ping is harmless. The sitemap still covers anything that slips through.

/** Public by design: IndexNow checks it at /<key>.txt (public/). */
export const INDEXNOW_KEY = "104d6e8716c367985460a4d23ffe04d8";
const WINDOW_MS = 10 * 60 * 1000;

export async function pingIndexNow(): Promise<number> {
  // Production only: previews and local runs mustn't announce URLs.
  if (process.env.VERCEL_ENV !== "production") return 0;
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const db = getSupabaseAdminClient();
  const [books, authors, topics, lists] = await Promise.all([
    db.from("materials").select("slug").eq("status", "published").eq("visibility", "public").gte("updated_at", since).limit(500),
    db.from("authors").select("slug").eq("bio_status", "approved").gte("updated_at", since).limit(500),
    db.from("topic_guides").select("slug").eq("status", "approved").gte("updated_at", since).limit(500),
    // A list counts from 07:00 on its day, when it goes live, not when approved.
    // Loaded here so scripts can import INDEXNOW_KEY without the server-only lists module.
    import("@/lib/readingLists/lists").then((m) => m.listsLiveSince(since)),
  ]);
  const urlList = [
    ...(books.data ?? []).map((r) => `${PLATFORM_URL}/library/${r.slug}`),
    ...(authors.data ?? []).map((r) => `${PLATFORM_URL}/authors/${r.slug}`),
    ...(topics.data ?? []).map((r) => `${PLATFORM_URL}/topics/${r.slug}`),
    ...lists.map((slug) => `${PLATFORM_URL}/reading-lists/${slug}`),
  ];
  if (!urlList.length) return 0;
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: new URL(PLATFORM_URL).host, key: INDEXNOW_KEY, keyLocation: `${PLATFORM_URL}/${INDEXNOW_KEY}.txt`, urlList }),
  });
  // 200/202 accepted; anything else is logged, never thrown: the cron's other jobs matter more.
  if (!res.ok) console.error("[indexnow]", res.status, await res.text().catch(() => ""));
  return urlList.length;
}

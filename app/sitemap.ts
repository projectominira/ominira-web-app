import type { MetadataRoute } from "next";
import { PLATFORM_URL } from "@/lib/config/platform";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { allRows } from "@/lib/supabase/allRows";
import { slugifyCategory } from "@/lib/categories/slug";
import { quoteFacets } from "@/lib/quotes/directory";
import { indexableAuthors } from "@/lib/authors/authors";

/** An author's quote page is listed once it has a few quotes (not thin). */
const MIN_AUTHOR_QUOTES = 3;

// Rebuilt at most hourly, so newly published books show up without a deploy.
// The landing page ("/") leads; /home is signed in only and noindex.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Paged: a plain select stopped at 1000 rows and left books out (seo audit, 12 Nov).
  const books = await allRows((from, to) =>
    getSupabaseAdminClient()
      .from("materials")
      .select("slug, updated_at")
      .eq("status", "published")
      .eq("visibility", "public")
      .order("id")
      .range(from, to)
  );

  // The quote directory's views (seo-spec C4); never fails the sitemap.
  const facets = await quoteFacets().catch((err) => {
    console.error("[sitemap] quote facets", err);
    return { authors: [], topics: [] };
  });
  // Author pages worth indexing (seo-spec C2), and their hub.
  const authors = await indexableAuthors().catch((err) => {
    console.error("[sitemap] authors", err);
    return [];
  });
  const authorPaths = authors.length ? ["/authors", ...authors.map((a) => `/authors/${a.slug}`)] : [];

  const quotes = [
    ...(facets.authors.length ? [`/quotes`] : []),
    ...facets.topics.map((t) => `/quotes/topic/${slugifyCategory(t)}`),
    ...facets.authors.filter((a) => a.quotes >= MIN_AUTHOR_QUOTES).map((a) => `/quotes/${a.slug}`),
  ];

  return [
    { url: `${PLATFORM_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${PLATFORM_URL}/library`, changeFrequency: "daily", priority: 0.9 },
    ...authorPaths.map((path) => ({ url: `${PLATFORM_URL}${path}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...quotes.map((path) => ({ url: `${PLATFORM_URL}${path}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...books.map((book) => ({
      url: `${PLATFORM_URL}/library/${book.slug}`,
      lastModified: book.updated_at ?? undefined,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}

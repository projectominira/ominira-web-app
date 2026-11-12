import type { MetadataRoute } from "next";
import { PLATFORM_URL } from "@/lib/config/platform";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { allRows } from "@/lib/supabase/allRows";

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

  return [
    { url: `${PLATFORM_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${PLATFORM_URL}/library`, changeFrequency: "daily", priority: 0.9 },
    ...books.map((book) => ({
      url: `${PLATFORM_URL}/library/${book.slug}`,
      lastModified: book.updated_at ?? undefined,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}

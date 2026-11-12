import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";

/** The current slug of the published book that once had `slug`, if any (seo-spec.md T2). */
export const renamedTo = cache(async (slug: string): Promise<string | null> => {
  const { data } = await getSupabaseAdminClient()
    .from("materials")
    .select("slug")
    .contains("old_slugs", [slug])
    .eq("status", "published")
    .limit(1)
    .maybeSingle();
  return data?.slug ?? null;
});

/**
 * For a slug no book has: to the book's current URL if it was renamed,
 * otherwise not-found (noindex). The loading.tsx shells have already sent a
 * 200 by then, so the redirect happens in the browser; search crawlers get a
 * real 308/404 from proxy.ts before the page renders (seo-spec.md T2, T6).
 */
export async function missingBook(slug: string, path: (current: string) => string): Promise<never> {
  const current = await renamedTo(slug);
  if (current) permanentRedirect(path(current));
  notFound();
}

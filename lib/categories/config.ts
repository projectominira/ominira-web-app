import "server-only";

import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";

export const CATEGORIES_CACHE_TAG = "categories";

export const getCategories = unstable_cache(
  async (): Promise<string[]> => {
    const { data, error } = await getSupabaseAdminClient()
      .from("categories")
      .select("name")
      .order("position");
    if (error) throw error;
    return (data ?? []).map((row) => row.name);
  },
  ["categories"],
  { tags: [CATEGORIES_CACHE_TAG], revalidate: 3600 },
);

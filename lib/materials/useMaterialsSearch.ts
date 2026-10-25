"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { MaterialSummary } from "@/lib/api/types";

type Options = {
  /** Omitted or "All" — no server-side category filter. */
  category?: string | null;
  limit?: number;
  /** Also match saved web pages (excluded from the library shelf). */
  includeWebpages?: boolean;
};

/**
 * Debounced `GET /api/materials?search=` — the one live, catalog-wide book
 * search every "search books" entry point reads from (SearchModal's
 * library-wide mode, which every page that can open it — home, library —
 * shares), so a query is always answered against the *whole* materials
 * table, never just whatever page of results happens to already be
 * sitting in the browser. Results come back relevance-ranked, not just
 * recency-ranked (see lib/materials/list.ts's relevanceScore). Its own
 * hook rather than TanStack Query: this is throwaway, component-lifetime-
 * only search state, not data worth caching/sharing across the app the
 * way a real query key would imply.
 */
export function useMaterialsSearch(query: string, opts: Options = {}) {
  const { category, limit = 24, includeWebpages = false } = opts;
  const [results, setResults] = useState<MaterialSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ search: q, limit: String(limit) });
      if (category && category !== "All") params.set("category", category);
      if (includeWebpages) params.set("includeWebpages", "true");
      apiFetch<{ items: MaterialSummary[] }>(`/materials?${params.toString()}`)
        .then((r) => setResults(r.items))
        .catch(() => setResults([]))
        .finally(() => setIsSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, category, limit, includeWebpages]);

  return { results, isSearching };
}

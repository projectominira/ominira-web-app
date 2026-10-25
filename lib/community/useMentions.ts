"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { communityKeys } from "@/lib/community/queryKeys";
import { useDebounced } from "@/lib/time/useDebounced";
import type { MentionCandidate } from "@/lib/community/mentionTypes";

/** Tag suggestions for `query`, or the comrades you've engaged with when
 * it's empty (GET /api/community/mentions). Null `query` is off. */
export function useMentionCandidates(query: string | null, groupSlug: string | null) {
  const q = useDebounced(query, 150);
  return useQuery({
    queryKey: communityKeys.mentions(q ?? "", groupSlug),
    queryFn: () =>
      apiFetch<{ readers: MentionCandidate[] }>(
        `/community/mentions?${new URLSearchParams({
          q: q ?? "",
          ...(groupSlug && { group: groupSlug }),
        })}`
      ).then((r) => r.readers),
    enabled: q !== null,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

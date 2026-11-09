"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { communityKeys } from "@/lib/community/queryKeys";
import type { FeedItem } from "@/lib/community/feed";

// The feed item's deep link lives in a plain module so the server can build
// it too (lib/rooms/homeView.ts); re-exported for the client call sites.
export { communityFeedItemHref } from "./feedHref";

/** The two sorts CommunityFeedSortToggle's UI exposes — `GET
 * /api/community/notes` also supports `trending`, not wired to any control
 * yet (out of scope for this pass, same as it was before this feed had a
 * real backend at all). */
export type CommunityFeedSort = "recent" | "top";

/** `GET /api/community/notes` — the home community feed: every top-level
 * note the viewer can read (lib/community/visibility.ts), one stream with no
 * topic filter (studygroup-spec.md §4.5). The discovery surface, not a
 * per-book thread view. */
export function useCommunityFeed(sort: CommunityFeedSort) {
  return useQuery({
    queryKey: communityKeys.feed(sort),
    queryFn: () => apiFetch<{ items: FeedItem[]; nextCursor: string | null }>(`/community/notes?sort=${sort}&limit=20`),
  });
}

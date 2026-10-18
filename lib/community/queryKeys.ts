// Shared TanStack Query keys for the community/notes domain.
export const communityKeys = {
  // Keyed by sort mode — "recent"/"top"/"trending" are genuinely different
  // queries (different server-side ordering), not the same list refetched.
  feed: (sort: string) => ["community", "notes", "feed", sort] as const,
  // A group's Notes tab (lib/groups/notes.ts), under the feed prefix so every
  // note write below patches or refetches it too. `book` is its filter.
  thread: (noteId: string) => ["community", "notes", "thread", noteId] as const,
  // Prefix used by invalidateNoteQueries below to blanket-invalidate every
  // feed sort at once (TanStack Query matches invalidateQueries by key
  // prefix) — a new/edited/deleted note can change any of them.
  feedPrefix: ["community", "notes", "feed"] as const,
  linkPreview: (url: string) => ["community", "link-preview", url] as const,
  mentions: (q: string, group: string | null) => ["community", "mentions", group, q] as const,
};

// Shared TanStack Query keys for the groups domain. Every key starts with
// `all`, so a membership write refetches the list, the header and the members
// in one invalidation. Responses that depend on who's asking carry the viewer.
export const groupKeys = {
  all: ["groups"] as const,
  // "@" can't appear in a slug, so this never collides with a group's keys.
  list: (viewer: string | null) => ["groups", "@list", viewer ?? "anon"] as const,
  page: (slug: string, viewer: string | null) => ["groups", slug, "page", viewer ?? "anon"] as const,
  members: (slug: string) => ["groups", slug, "members"] as const,
  books: (slug: string) => ["groups", slug, "books"] as const,
  target: (slug: string, viewer: string | null) => ["groups", slug, "target", viewer ?? "anon"] as const,
  sessions: (slug: string, viewer: string | null) => ["groups", slug, "sessions", viewer ?? "anon"] as const,
  // The group's room (rooms-spec §5.1): under the group, so every group
  // write (a target, a session, a room started) brings its line in.
  stream: (slug: string, viewer: string | null) => ["groups", slug, "stream", viewer ?? "anon"] as const,
};

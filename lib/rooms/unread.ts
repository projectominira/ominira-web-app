// Unread in a room (rooms-spec §5.2, 7c): what came in since the reader last
// read to the bottom (or, never opened, since they joined: lib/rooms/reads).
// Only comrades' notes and replies count; your own, lines and cards never
// do. Pure.

import type { RoomItem, RoomNote } from "./types";

const isUnread = (it: RoomItem, lastReadAt: number, viewerId: string | null) =>
  it.t === "note" && it.note.note.author.readerId !== viewerId && Date.parse(it.note.note.createdAt) > lastReadAt;

/** Comrades' replies under a note after `lastReadAt`. */
const newReplies = (n: RoomNote, lastReadAt: number, viewerId: string | null) =>
  n.replies.reduce((c, r) => c + (r.author.readerId !== viewerId && Date.parse(r.createdAt) > lastReadAt ? 1 : 0), 0);

/** Comrades' notes after `lastReadAt`. Signed out, none. */
export function unreadCount(items: RoomItem[], lastReadAt: string | null, viewerId: string | null): number {
  if (!lastReadAt) return 0;
  const since = Date.parse(lastReadAt);
  return items.reduce((n, it) => n + (isUnread(it, since, viewerId) ? 1 : 0), 0);
}

/** The unread divider before the first unread note, with the count, and
 * each note's new replies. */
export function withUnread(items: RoomItem[], lastReadAt: string | null, viewerId: string | null): RoomItem[] {
  if (!lastReadAt) return items;
  const since = Date.parse(lastReadAt);
  const marked = items.map((it): RoomItem => {
    if (it.t !== "note") return it;
    const n = newReplies(it.note, since, viewerId);
    return n ? { t: "note", note: { ...it.note, newReplies: n } } : it;
  });
  const count = unreadCount(marked, lastReadAt, viewerId);
  if (!count) return marked;
  // Run after withDays, so a day divider right above stays above it (7c).
  const at = marked.findIndex((it) => isUnread(it, since, viewerId));
  return [...marked.slice(0, at), { t: "unread", count }, ...marked.slice(at)];
}

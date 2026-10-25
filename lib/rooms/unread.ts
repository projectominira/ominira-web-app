// Unread in a room (rooms-spec §5.2, 7c): what came in since the reader last
// read to the bottom. Only comrades' notes count; your own notes, lines and
// cards never do. Pure.

import type { RoomItem } from "./types";

const isUnread = (it: RoomItem, lastReadAt: number, viewerId: string | null) =>
  it.t === "note" && it.note.note.author.readerId !== viewerId && Date.parse(it.note.note.createdAt) > lastReadAt;

/** Comrades' notes after `lastReadAt`. A room never read has none: the
 * divider is for coming back, not for the first visit. */
export function unreadCount(items: RoomItem[], lastReadAt: string | null, viewerId: string | null): number {
  if (!lastReadAt) return 0;
  const since = Date.parse(lastReadAt);
  return items.reduce((n, it) => n + (isUnread(it, since, viewerId) ? 1 : 0), 0);
}

/** The unread divider before the first unread note, with the count. */
export function withUnread(items: RoomItem[], lastReadAt: string | null, viewerId: string | null): RoomItem[] {
  const count = unreadCount(items, lastReadAt, viewerId);
  if (!count) return items;
  const since = Date.parse(lastReadAt!);
  // Run after withDays, so a day divider right above stays above it (7c).
  const at = items.findIndex((it) => isUnread(it, since, viewerId));
  return [...items.slice(0, at), { t: "unread", count }, ...items.slice(at)];
}

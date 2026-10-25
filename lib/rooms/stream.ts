import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { encodeCursor, keysetBeforeFilter, type Keyset } from "@/lib/api/cursor";
import { resolveExcerpt } from "@/lib/community/excerpt";
import { enrichFeedItems } from "@/lib/community/feed";
import type { NoteRow } from "@/lib/community/notes";
import { loadPostViewer } from "@/lib/community/viewer";
import { visiblePostsFilter, type PostViewer } from "@/lib/community/visibility";
import { toMilestone } from "@/lib/groups/milestones";
import { loadSectionLabels } from "@/lib/materials/sectionLabels";
import type { AnnotationRange, Note } from "@/lib/api/types";
import type { Group } from "@/lib/groups/membership";
import type { Database } from "@/lib/supabase/database.types";
import { comradesById } from "./comrades";
import { officialReaderIds, pagePassages } from "./passage";
import { lastReadAt } from "./reads";
import {
  eventItem,
  mergePage,
  roomEndItem,
  roomStartItem,
  toRoomNote,
  type GroupEventPayload,
  type NoteContext,
  type RoomRun,
  type Stamped,
} from "./timeline";
import type { RoomItem, RoomStreamPage } from "./types";

// A room's stream, one page per call (rooms-spec §5.1), for the thin
// app/api/groups/{slug}/stream and app/api/materials/{id}/stream routes.
// Each source is read as the `limit + 1` rows before the cursor, in
// parallel; lib/rooms/timeline merges the raw rows, and only the page's are
// enriched.

const STREAM_PAGE = 30;
const STREAM_PAGE_MAX = 50;

/** `?limit=`, clamped. */
export const pageLimit = (url: URL) => Math.min(Math.max(Number(url.searchParams.get("limit")) || STREAM_PAGE, 1), STREAM_PAGE_MAX);

type Page = { cursor: Keyset | null; limit: number };
type Tables = Database["public"]["Tables"];
type EventRow = Tables["group_events"]["Row"];
type MilestoneRow = Tables["group_milestones"]["Row"];
type RoomRow = Pick<Tables["rooms"]["Row"], "id" | "started_by" | "started_at" | "ended_at">;
type HighlightRow = Tables["highlights"]["Row"];

type GroupRow =
  | { t: "post"; row: NoteRow }
  | { t: "event"; row: EventRow }
  | { t: "milestone"; row: MilestoneRow };

type BookRow = { t: "post"; row: NoteRow } | { t: "start" | "end"; row: RoomRow } | { t: "highlight"; row: HighlightRow };

const newestFirst = <Q extends { order: (c: string, o: { ascending: boolean }) => Q }>(q: Q, column = "created_at") =>
  q.order(column, { ascending: false }).order("id", { ascending: false });

const rowsOf = <R extends { t: string }, T extends R["t"]>(rows: R[], t: T) => rows.filter((r): r is Extract<R, { t: T }> => r.t === t);

/** The group room's notes, as a PostgREST `or` filter: posted in the group,
 * or by a member on a book from its list. Home's group row reads the same. */
export function groupPostScope(groupId: string, memberIds: string[], materialIds: string[]): string {
  const scope = [`group_id.eq.${groupId}`];
  if (memberIds.length && materialIds.length) scope.push(`and(reader_id.in.(${memberIds.join(",")}),material_id.in.(${materialIds.join(",")}))`);
  return scope.join(",");
}

/** The group's room: notes posted in the group or by a member on a book from
 * its list (the Notes tab's lens, unchanged), group events and milestones.
 * The viewer's grants load alongside the group's own reads. */
export async function groupStreamPage(group: Group, readerId: string | null, { cursor, limit }: Page): Promise<RoomStreamPage> {
  const admin = getSupabaseAdminClient();
  const before = <Q extends { or: (f: string) => Q }>(q: Q) => (cursor ? q.or(keysetBeforeFilter(cursor)) : q);
  const [viewer, members, books, events, milestones, lastRead, officialIds] = await Promise.all([
    loadPostViewer(readerId),
    admin.from("group_members").select("reader_id, role").eq("group_id", group.id),
    admin.from("group_books").select("material_id").eq("group_id", group.id),
    newestFirst(before(admin.from("group_events").select("*").eq("group_id", group.id))).limit(limit + 1),
    newestFirst(before(admin.from("group_milestones").select("*").eq("group_id", group.id))).limit(limit + 1),
    cursor ? null : lastReadAt(readerId, "group", group.id),
    officialReaderIds(),
  ]);
  if (members.error) throw members.error;
  if (books.error) throw books.error;
  if (events.error) throw events.error;
  if (milestones.error) throw milestones.error;

  const scope = groupPostScope(
    group.id,
    members.data.map((m) => m.reader_id),
    books.data.map((b) => b.material_id)
  );
  const posts = await newestFirst(before(admin.from("posts").select("*").is("parent_id", null).or(visiblePostsFilter(viewer)).or(scope))).limit(limit + 1);
  if (posts.error) throw posts.error;

  const page = mergePage<GroupRow>(
    [
      (posts.data as NoteRow[]).map((row) => ({ at: row.created_at, id: row.id, item: { t: "post", row } })),
      events.data.map((row) => ({ at: row.created_at, id: row.id, item: { t: "event", row } })),
      milestones.data.map((row) => ({ at: row.created_at, id: row.id, item: { t: "milestone", row } })),
    ],
    limit
  );
  const pagePosts = rowsOf(page.items, "post").map((r) => r.row);
  const pageEvents = rowsOf(page.items, "event").map((r) => r.row);
  const finished = rowsOf(page.items, "milestone").flatMap(({ row }) => (row.kind === "book_finished" && row.material_id ? [row.material_id] : []));

  const now = Date.now();
  const [feed, actors, titles, passages] = await Promise.all([
    enrichFeedItems(pagePosts, viewer),
    comradesById(pageEvents.flatMap((e) => (e.actor_id ? [e.actor_id] : []))),
    titlesById(finished),
    pagePassages(pagePosts, now),
  ]);
  const ctx: NoteContext = {
    now,
    pinnedId: group.pinned_post_id,
    teamIds: new Set(members.data.filter((m) => m.role === "moderator").map((m) => m.reader_id)),
    officialIds,
    passages,
    alsoIn: false,
  };
  const notes = new Map(feed.map((it) => [it.note.id, it]));
  const items = page.items.flatMap((r): RoomItem[] => {
    if (r.t === "post") {
      const it = notes.get(r.row.id);
      return it ? [{ t: "note", note: toRoomNote(it, ctx) }] : [];
    }
    if (r.t === "milestone") {
      const m = r.row;
      return [{ t: "milestone", milestone: toMilestone(m), book: (m.material_id && titles.get(m.material_id)) || null }];
    }
    const e = r.row;
    const item = eventItem({
      id: e.id,
      kind: e.kind,
      actor: (e.actor_id && actors.get(e.actor_id)) || null,
      ref: e.ref,
      payload: e.payload as GroupEventPayload,
      createdAt: e.created_at,
    });
    return item ? [item] : [];
  });
  return { items, nextCursor: page.cursor && encodeCursor(page.cursor), lastReadAt: lastRead };
}

/** A book's room: its notes the viewer can read (public, plus their own and
 * those shared with them, through visiblePostsFilter), its highlights
 * (public, plus the viewer's own private ones), and its reading rooms as
 * they start and end. A group's rooms show to its members only. No events. */
export async function bookStreamPage(materialId: string, viewer: PostViewer, { cursor, limit }: Page): Promise<RoomStreamPage> {
  const admin = getSupabaseAdminClient();
  const before = <Q extends { or: (f: string) => Q }>(q: Q, column?: string) => (cursor ? q.or(keysetBeforeFilter(cursor, column)) : q);
  const roomScope = viewer?.groupIds.length ? `group_id.is.null,group_id.in.(${viewer.groupIds.join(",")})` : "group_id.is.null";
  const rooms = () => admin.from("rooms").select("id, started_by, started_at, ended_at").eq("material_id", materialId).or(roomScope);
  const highlightScope = viewer ? `visibility.eq.public,reader_id.eq.${viewer.readerId}` : "visibility.eq.public";
  const [posts, highlights, starts, ends, lastRead, officialIds] = await Promise.all([
    newestFirst(before(admin.from("posts").select("*").eq("material_id", materialId).is("parent_id", null).or(visiblePostsFilter(viewer)))).limit(
      limit + 1
    ),
    newestFirst(before(admin.from("highlights").select("*").eq("material_id", materialId).or(highlightScope))).limit(limit + 1),
    newestFirst(before(rooms(), "started_at"), "started_at").limit(limit + 1),
    newestFirst(before(rooms().eq("status", "ended"), "ended_at"), "ended_at").limit(limit + 1),
    cursor ? null : lastReadAt(viewer?.readerId, "book", materialId),
    officialReaderIds(),
  ]);
  if (posts.error) throw posts.error;
  if (highlights.error) throw highlights.error;
  if (starts.error) throw starts.error;
  if (ends.error) throw ends.error;

  const page = mergePage<BookRow>(
    [
      (posts.data as NoteRow[]).map((row) => ({ at: row.created_at, id: row.id, item: { t: "post", row } })),
      highlights.data.map((row) => ({ at: row.created_at, id: row.id, item: { t: "highlight", row } })),
      starts.data.map((row) => ({ at: row.started_at, id: row.id, item: { t: "start", row } })),
      ends.data.map((row) => ({ at: row.ended_at!, id: row.id, item: { t: "end", row } })),
    ] satisfies Stamped<BookRow>[][],
    limit
  );
  const pagePosts = rowsOf(page.items, "post").map((r) => r.row);
  const pageRooms = page.items.flatMap((r) => (r.t === "start" || r.t === "end" ? [r] : []));
  const pageHighlights = rowsOf(page.items, "highlight").map((r) => r.row);

  const now = Date.now();
  const [feed, people, joined, passages, book] = await Promise.all([
    enrichFeedItems(pagePosts, viewer),
    comradesById([...pageRooms.filter((r) => r.t === "start").map((r) => r.row.started_by), ...pageHighlights.map((h) => h.reader_id)]),
    joinedCounts(pageRooms.filter((r) => r.t === "end").map((r) => r.row.id)),
    pagePassages(pagePosts, now),
    pageHighlights.length ? highlightBook(materialId) : null,
  ]);
  const ctx: NoteContext = { now, pinnedId: null, teamIds: new Set(), officialIds, passages, alsoIn: true };
  const notes = new Map(feed.map((it) => [it.note.id, it]));
  const run = (r: RoomRow): RoomRun => ({
    id: r.id,
    starter: people.get(r.started_by) ?? null,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    joined: joined.get(r.id) ?? 0,
  });
  const items = page.items.flatMap((r): RoomItem[] => {
    if (r.t === "start") return [roomStartItem(run(r.row))];
    if (r.t === "end") return [roomEndItem({ ...run(r.row), endedAt: r.row.ended_at! })];
    if (r.t === "highlight") {
      const author = people.get(r.row.reader_id);
      return author && book ? [highlightItem(r.row, author, book)] : [];
    }
    const it = notes.get(r.row.id);
    return it ? [{ t: "note", note: toRoomNote(it, ctx) }] : [];
  });
  return { items, nextCursor: page.cursor && encodeCursor(page.cursor), lastReadAt: lastRead };
}

type HighlightBook = { slug: string; labels: Map<string, string> | undefined };

/** What a highlight needs from its book: where the reader opens, and its
 * section labels. */
async function highlightBook(materialId: string): Promise<HighlightBook | null> {
  const { data, error } = await getSupabaseAdminClient().from("materials").select("id, slug, json_storage_path").eq("id", materialId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { slug: data.slug, labels: (await loadSectionLabels([data])).get(data.id) };
}

/** A highlight as the room shows it: the line, where it is, who marked it. */
function highlightItem(row: HighlightRow, author: Note["author"], book: HighlightBook): RoomItem {
  const ranges = row.ranges as AnnotationRange[];
  const { sectionId, label, excerpt } = resolveExcerpt(ranges, book.labels);
  const passage = ranges[0]?.passageId;
  const href = `/read/${book.slug}${sectionId ? `?${new URLSearchParams({ section: sectionId, ...(passage ? { passage } : {}) })}` : ""}`;
  return { t: "highlight", id: row.id, author, visibility: row.visibility, excerpt, label, ranges, href, at: row.created_at };
}

/** Everyone who came to each room (room_members keeps leavers). */
async function joinedCounts(roomIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (roomIds.length === 0) return counts;
  const { data, error } = await getSupabaseAdminClient().from("room_members").select("room_id").in("room_id", roomIds);
  if (error) throw error;
  for (const r of data) counts.set(r.room_id, (counts.get(r.room_id) ?? 0) + 1);
  return counts;
}

async function titlesById(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await getSupabaseAdminClient().from("materials").select("id, title").in("id", [...new Set(ids)]);
  if (error) throw error;
  return new Map(data.map((m) => [m.id, m.title]));
}

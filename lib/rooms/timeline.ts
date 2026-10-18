// A room's timeline (rooms-spec §5.1): notes, group events and milestones
// merged into one keyset-paged stream, newest page first, each page oldest
// to newest. Consecutive joins collapse here, when read, never when stored.
// Pure: lib/rooms/stream.ts loads the rows, and the client runs the same
// collapse, day dividers and card placement over every page it holds.

import type { Keyset } from "@/lib/api/cursor";
import type { Note } from "@/lib/api/types";
import type { FeedItem } from "@/lib/community/feed";
import { comradeCount } from "@/lib/groups/copy";
import type { GroupEventKind } from "@/lib/supabase/database.types";
import { localDay } from "@/lib/time/zone";
import { OFFICIAL_TAG } from "./names";
import type { Comrade, RoomItem, RoomNote, RoomStreamPage } from "./types";
import { withUnread } from "./unread";

/** "Replying now" (spec §2): distinct repliers in the last 10 minutes. */
export const REPLYING_NOW_MS = 10 * 60_000;
/** The footer's avatars. */
const FOOTER_REPLIERS = 3;
export const TEAM_TAG = "Moderator";
export const PASSAGE_PIN = "Passage of the day";

/** A row from any source, with the keyset it sorts on. `at` is the row's
 * own created_at string, so the cursor matches the database exactly. */
export type Stamped<T = RoomItem> = { at: string; id: string; item: T };

/** Newest first: (at, id) descending, as every source is queried. Same-ms
 * timestamps fall back to the string (PostgREST's fractional seconds sort
 * as text). */
export function newerFirst(a: Pick<Stamped, "at" | "id">, b: Pick<Stamped, "at" | "id">): number {
  const d = Date.parse(b.at) - Date.parse(a.at);
  if (d) return d;
  if (a.at !== b.at) return a.at < b.at ? 1 : -1;
  return a.id === b.id ? 0 : a.id < b.id ? 1 : -1;
}

/**
 * One page from several sources, each already the `limit + 1` rows before
 * the cursor, newest first. The newest `limit` overall are the page, so no
 * row is skipped or repeated across pages. Returns the page oldest first and
 * the cursor for the page before it (null at the start of the room). The
 * rows can be raw: only the page's need turning into items.
 */
export function mergePage<T>(sources: Stamped<T>[][], limit: number): { items: T[]; cursor: Keyset | null } {
  const all = sources.flat().sort(newerFirst);
  const page = all.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.reverse().map((s) => s.item),
    cursor: all.length > limit && last ? { createdAt: last.at, id: last.id } : null,
  };
}

/** A group_events row with its actor. `payload` is the line's frozen
 * words (migrations/20261104_group_events.sql). */
export type GroupEvent = {
  id: string;
  kind: GroupEventKind;
  actor: Comrade | null;
  ref: string | null;
  payload: GroupEventPayload;
  createdAt: string;
};

export type GroupEventPayload = {
  title?: string;
  status?: string;
  end_label?: string;
  topic?: string;
  section_label?: string | null;
};

/** A group event as a stream item: a join, or a centred line. */
export function eventItem(ev: GroupEvent): RoomItem | null {
  const { id, payload: p, createdAt: at, ref } = ev;
  if (ev.kind === "joined") return ev.actor ? { t: "joins", id, comrades: [ev.actor], at } : null;
  const line = (text: string, em: string | null = null, post: string | null = null, mic = false): RoomItem => ({
    t: "system", id, actor: ev.actor?.pseudonym ?? null, text, em, post, mic, at, ref,
  });
  switch (ev.kind) {
    case "target_set":
      return line("set this week’s target:", p.end_label ?? null);
    case "book_current":
      return line("moved", p.title ?? null, "to Reading now");
    case "book_added":
      return line("added", p.title ?? null, "to the reading list");
    case "session_scheduled":
      return line("scheduled", p.topic ?? null);
    case "room_started":
      return p.section_label ? line("started the reading room on", p.section_label, null, true) : line("started the reading room", null, null, true);
  }
}

/** A reading room on a book (spec §5.1): its start and its end are lines in
 * the book's room. `joined` is everyone who came. */
export type RoomRun = { id: string; starter: Comrade | null; startedAt: string; endedAt: string | null; joined: number };

export function roomStartItem(r: RoomRun): RoomItem {
  return { t: "system", id: `${r.id}-start`, actor: r.starter?.pseudonym ?? null, text: "started a reading room", em: null, post: null, mic: true, at: r.startedAt, ref: r.id };
}

/** "Reading room ended · 34 min · 6 comrades joined". */
export function roomEndItem(r: RoomRun & { endedAt: string }): RoomItem {
  const minutes = Math.max(1, Math.round((Date.parse(r.endedAt) - Date.parse(r.startedAt)) / 60_000));
  return {
    t: "system", id: `${r.id}-end`, actor: null, text: `Reading room ended · ${minutes} min · ${comradeCount(r.joined)} joined`,
    em: null, post: null, mic: true, at: r.endedAt, ref: r.id,
  };
}

/** Where an item sits in time; cards and dividers have none of their own. */
export function itemAt(it: RoomItem): string | null {
  switch (it.t) {
    case "note":
      return it.note.note.createdAt;
    case "system":
    case "joins":
    case "highlight":
      return it.at;
    case "milestone":
      return it.milestone.createdAt;
    default:
      return null;
  }
}

/** `extra` merged into `items` (oldest first) by time. With older pages
 * still to load, only what's no older than the oldest item loaded, so
 * nothing lands above the history that hasn't arrived yet. */
export function mergeByTime(items: RoomItem[], extra: RoomItem[], olderToLoad = false): RoomItem[] {
  const time = (it: RoomItem) => {
    const at = itemAt(it);
    return at === null ? null : Date.parse(at);
  };
  const first = items.map(time).find((t) => t !== null) ?? null;
  const add = extra.filter((x) => !olderToLoad || first === null || time(x)! >= first).sort((a, b) => time(a)! - time(b)!);
  if (add.length === 0) return items;
  const out: RoomItem[] = [];
  let j = 0;
  for (const it of items) {
    const t = time(it);
    while (t !== null && j < add.length && time(add[j])! < t) out.push(add[j++]);
    out.push(it);
  }
  return [...out, ...add.slice(j)];
}

/** Consecutive joins on the same day become one line, in the order they
 * joined; someone who joined twice counts once. Idempotent, so it runs on
 * each page and again over the pages joined up. */
export function collapseJoins(items: RoomItem[], tz: string): RoomItem[] {
  const out: RoomItem[] = [];
  for (const it of items) {
    const prev = out[out.length - 1];
    if (it.t === "joins" && prev?.t === "joins" && localDay(Date.parse(prev.at), tz) === localDay(Date.parse(it.at), tz)) {
      const seen = new Set(prev.comrades.map((c) => c.readerId));
      out[out.length - 1] = { ...prev, comrades: [...prev.comrades, ...it.comrades.filter((c) => !seen.has(c.readerId))], at: it.at };
    } else {
      out.push(it);
    }
  }
  return out;
}

/** A day divider before the first item of each local day. */
export function withDays(items: RoomItem[], tz: string): RoomItem[] {
  const out: RoomItem[] = [];
  let day: string | null = null;
  for (const it of items) {
    const at = itemAt(it);
    const d: string | null = at ? localDay(Date.parse(at), tz) : day;
    if (d && d !== day) out.push({ t: "day", day: d });
    day = d;
    out.push(it);
  }
  return out;
}

/** The action cards (spec §5.1 "anchors"): each card goes after the line
 * about its `ref` (the target set, the session scheduled, the room
 * started), or at the bottom while that line isn't loaded. */
export function placeCards(items: RoomItem[], cards: { ref: string; item: RoomItem }[]): RoomItem[] {
  if (cards.length === 0) return items;
  const out: RoomItem[] = [];
  const placed = new Set<string>();
  for (const it of items) {
    out.push(it);
    if (it.t !== "system" || !it.ref) continue;
    for (const c of cards) {
      if (c.ref === it.ref && !placed.has(c.ref)) {
        out.push(c.item);
        placed.add(c.ref);
      }
    }
  }
  for (const c of cards) if (!placed.has(c.ref)) out.push(c.item);
  return out;
}

export type NoteContext = {
  now: number;
  pinnedId: string | null;
  /** The group's moderators: "Moderator". */
  teamIds: ReadonlySet<string>;
  /** The official account (2.8): "Ominira". */
  officialIds: ReadonlySet<string>;
  /** Passages of the day among the page's notes (2.8), by post id: each
   * keeps its question; only today's is pinned. */
  passages: ReadonlyMap<string, { question: string; today: boolean }>;
  /** A book room labels notes that are in a group too ("Also in …"). */
  alsoIn: boolean;
};

/** A feed item as a bubble. The thread is shipped with the item, so the
 * footer and "replying now" (spec §2) cost no query of their own. */
export function toRoomNote(item: FeedItem, ctx: NoteContext): RoomNote {
  const { note, replies } = item;
  const latestFirst: Comrade[] = [];
  const seen = new Set<string>();
  const recent = new Set<string>();
  for (let i = replies.length - 1; i >= 0; i--) {
    const { author, createdAt } = replies[i];
    if (!seen.has(author.readerId)) {
      seen.add(author.readerId);
      latestFirst.push({ readerId: author.readerId, pseudonym: author.pseudonym, avatar: author.avatar });
    }
    if (ctx.now - Date.parse(createdAt) <= REPLYING_NOW_MS) recent.add(author.readerId);
  }
  const author = note.author.readerId;
  const passage = ctx.passages.get(note.id) ?? null;
  const question = passage?.question ?? null;
  return {
    ...item,
    authorTag: ctx.officialIds.has(author) ? OFFICIAL_TAG : ctx.teamIds.has(author) ? TEAM_TAG : null,
    fromReader: item.excerpt !== null && question === null,
    pinned: passage?.today ? PASSAGE_PIN : note.id === ctx.pinnedId ? "Pinned" : null,
    question,
    replyCount: replies.length,
    repliers: latestFirst.slice(0, FOOTER_REPLIERS),
    replierCount: latestFirst.length,
    replyingNow: recent.size,
    alsoIn: ctx.alsoIn ? (note.group?.name ?? null) : null,
  };
}

/** Who's reading now (6a) heads today: after today's divider, or under a
 * divider of its own when nothing has been said today. An empty room stays
 * the empty state. Runs after withDays. */
export function withReadingNow(items: RoomItem[], reading: RoomItem | null, today: string): RoomItem[] {
  if (!reading || items.length === 0) return items;
  const at = items.findIndex((it) => it.t === "day" && it.day === today);
  return at < 0 ? [...items, { t: "day", day: today }, reading] : [...items.slice(0, at + 1), reading, ...items.slice(at + 1)];
}

/** A room as shown: its pages (newest page first, as fetched) joined oldest
 * first, joins collapsed, the cards placed, your notes on their way at the
 * bottom, day dividers and the unread divider. The room's first page
 * carries when you last read it. */
export function roomItems(
  pages: RoomStreamPage[],
  o: {
    tz: string;
    viewerId: string | null;
    cards?: { ref: string; item: RoomItem }[];
    pending?: RoomItem[];
    /** A book room's reading-now stack, under today (`reading.today`). */
    reading?: { today: string; item: RoomItem } | null;
    /** What only the viewer has, merged in by time (the reader's own
     * highlights): only as far back as the pages loaded so far. */
    mine?: RoomItem[];
  }
): RoomItem[] {
  const items = [...pages].reverse().flatMap((p) => p.items);
  const older = pages.length > 0 && pages[pages.length - 1].nextCursor !== null;
  const placed = mergeByTime(placeCards(collapseJoins(items, o.tz), o.cards ?? []), o.mine ?? [], older);
  const days = withDays([...placed, ...(o.pending ?? [])], o.tz);
  return withUnread(o.reading ? withReadingNow(days, o.reading.item, o.reading.today) : days, pages[0]?.lastReadAt ?? null, o.viewerId);
}

/** Your note while it's sending (or failed): a bubble of its own, by the id
 * the stream keys its state on. */
export function pendingNote(id: string, text: string, author: Note["author"], at: string, group: Note["group"] = null): RoomNote {
  return {
    note: {
      id, materialId: null, author, ranges: [], parentId: null, replyingToId: null, content: { kind: "text", text }, visibility: "public",
      reactionCount: 0, reactedByMe: false, bookmarkedByMe: false, group, mentions: [], createdAt: at, updatedAt: at,
    },
    material: null, sectionId: null, label: null, excerpt: null, replies: [],
    authorTag: null, fromReader: false, pinned: null, question: null, replyCount: 0, repliers: [], replierCount: 0, replyingNow: 0, alsoIn: null,
  };
}

// Group info's content (rooms-spec §2, 4d / 9b): the reading list as a
// syllabus, the schedule and the members, from the views the page loads.
// Pure.

import type { GroupBook, GroupMember, SessionsView } from "@/lib/groups/types";
import type { ChapterEnd } from "@/lib/groups/progress";
import { resolveBookCoverSrc } from "@/lib/materials/image";
import { formatDay } from "@/lib/time/format";
import { chapterAt } from "./cards";
import { TEAM_TAG } from "./timeline";
import type { MemberRow, ReadingListRow, RoomSession } from "./types";

/** Past sessions shown; the rest are history. */
const PAST_SHOWN = 3;
/** Later sessions after the next. */
const LATER_SHOWN = 2;

/** Where someone is in the book: their chapter, or a percentage in a book
 * with no chapters. */
export const placeIn = (ends: ChapterEnd[], pct: number | null) => (pct === null ? null : (chapterAt(ends, pct) ?? `${Math.round(pct)}%`));

const row = (b: GroupBook, sub: string, pct: number | null = null): ReadingListRow => ({
  id: b.material.id,
  status: b.status,
  title: b.material.title,
  cover: resolveBookCoverSrc(b.material),
  sub,
  pct,
});

/** One list in reading order: reading now (with where the group mostly
 * is, and your progress), up next in order, then finished, latest first. */
export function readingList(books: GroupBook[], o: { groupAt: string | null; mine: number | null }): ReadingListRow[] {
  const now = books.find((b) => b.status === "current");
  const join = (...parts: (string | null | false)[]) => parts.filter(Boolean).join(" · ");
  return [
    ...(now ? [row(now, join(now.material.author, o.groupAt && `group is mostly on ${o.groupAt}`), o.mine)] : []),
    ...books.filter((b) => b.status === "next").map((b) => row(b, join(b.material.author, b.startsOn && `from ${formatDay(b.startsOn, "dayMonth")}`))),
    ...books
      .filter((b) => b.status === "done")
      .sort((a, b) => (b.finishedOn ?? "").localeCompare(a.finishedOn ?? ""))
      .map((b) => row(b, join(b.material.author, b.finishedOn && `finished ${formatDay(b.finishedOn, "dayMonth")}`))),
  ];
}

/** The schedule: the next session as its card, a few after it, and the
 * latest past ones with their room's minutes and who came. */
export function schedule(view: SessionsView, next: RoomSession | null): { next: RoomSession | null; later: RoomSession[]; past: RoomSession[] } {
  const plain = (state: RoomSession["state"]) => (session: RoomSession["session"]): RoomSession => {
    const run = view.runs[session.id];
    return { session, state, host: "", hostId: "", people: [], count: run?.joined ?? 0, reading: null, minutes: run?.minutes ?? null, summary: [] };
  };
  const first = next?.state === "upcoming" ? next : null;
  return {
    next: first,
    later: view.upcoming.slice(first ? 1 : 0, (first ? 1 : 0) + LATER_SHOWN).map(plain("upcoming")),
    past: view.past.slice(0, PAST_SHOWN).map(plain("ended")),
  };
}

/** Members, moderators first (as listed), The team wears its tag; you're
 * "You". `progress` gives each their percentage through the current book. */
export function memberRows(members: GroupMember[], o: { viewerId: string | null; progress?: Record<string, number | null> }): MemberRow[] {
  return members.map((m) => ({
    comrade: { readerId: m.readerId, pseudonym: m.pseudonym, avatar: m.avatar },
    role: m.readerId === o.viewerId ? "You" : m.role === "moderator" ? TEAM_TAG : null,
    ...(o.progress && { pct: o.progress[m.readerId] ?? null }),
  }));
}

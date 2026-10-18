// The action cards' words (rooms-spec §4, sheet #c4). Pure.

import { chapterLabel, comradeCount, sessionWhen } from "@/lib/groups/copy";
import { formatInstant } from "@/lib/time/format";
import { personName } from "./names";
import type { ChapterEnd } from "@/lib/groups/progress";
import type { GroupLiveRoom, GroupSession, SessionsView, TargetView } from "@/lib/groups/types";
import type { RoomSession, RoomTarget } from "./types";

const MINUTE = 60_000;

/** "Ch. 4–6" for a chapter target ("Ch. 6" when it starts and ends there,
 * or before the chapters load), "Up to 50%" for a percentage. */
export function rangeLabel(endLabel: string, byChapter: boolean, startLabel: string | null): string {
  if (!byChapter) return `Up to ${endLabel}`;
  return startLabel && startLabel !== endLabel ? `${startLabel}–${endLabel.replace(/^Ch\. /, "")}` : endLabel;
}

export function targetRange({ view, startLabel }: Pick<RoomTarget, "view" | "startLabel">): string {
  const t = view.target!;
  return rangeLabel(t.endLabel, t.endChapter !== null, startLabel);
}

/** The chapter a position falls in, as targets name it ("Ch. 4"): the
 * first that ends past it (a position at a chapter's end is the start of
 * the next), else the last. */
export function chapterAt(ends: ChapterEnd[], pct: number): string | null {
  if (ends.length === 0) return null;
  return chapterLabel((ends.find((e) => e.endPct > pct) ?? ends[ends.length - 1]).label);
}

/** The target card from the target view and the book's chapters; null with
 * no running target. */
export function toRoomTarget(view: TargetView, bookTitle: string, ends: ChapterEnd[]): RoomTarget | null {
  if (!view.target) return null;
  const pct = view.mine?.pct ?? null;
  return {
    view,
    bookTitle,
    setBy: view.setBy ?? "",
    startLabel: chapterAt(ends, view.target.startPct),
    myLabel: pct === null ? null : (chapterAt(ends, pct) ?? `${Math.round(pct)}%`),
  };
}

/** A live room's card (sheet #c4 live): the session it was started from
 * gives its topic and section; one started without is its own card, keyed
 * by the room's id (the `room_started` line's ref). */
export function liveCard(live: GroupLiveRoom, now: number, scheduled?: GroupSession): RoomSession {
  const session: GroupSession = scheduled ?? {
    id: live.id,
    seriesId: null,
    topic: live.title,
    materialId: live.materialId,
    sectionLabel: null,
    startsAt: live.startedAt,
    repeat: "once",
    remind: null,
    attended: null,
  };
  const where = session.sectionLabel ? ` ${session.sectionLabel}` : "";
  return {
    session: { ...session, startsAt: live.startedAt },
    state: "live",
    host: live.starterName,
    hostId: live.starterId,
    people: live.people,
    count: live.members,
    reading: `${personName(live.starterName)} reading${where}`,
    minutes: Math.max(0, Math.round((now - Date.parse(live.startedAt)) / MINUTE)),
    summary: [],
  };
}

/** The session card: the live room when there is one, else the next
 * session. */
export function toRoomSession(view: SessionsView, now: number): { ref: string; card: RoomSession } | null {
  const { live, next } = view;
  const upcoming = view.upcoming[0];
  if (live) return { ref: live.id, card: liveCard(live, now, view.upcoming.find((s) => s.id === live.sessionId)) };
  if (!upcoming || !next) return null;
  return {
    ref: upcoming.id,
    card: {
      session: upcoming,
      state: "upcoming",
      host: next.host?.pseudonym ?? "",
      hostId: next.host?.readerId ?? "",
      people: next.people,
      count: next.going,
      reading: null,
      minutes: null,
      summary: [],
    },
  };
}

/** The session card's line under its title. */
export function sessionMeta({ session, state, host, minutes }: RoomSession, hostIsYou: boolean): string {
  const start = Date.parse(session.startsAt);
  if (state === "live") return `Started ${formatInstant(start, "time")}${session.sectionLabel ? ` · ${session.sectionLabel}` : ""}`;
  if (state === "ended") {
    const ran = minutes ?? 0;
    return `Ended ${formatInstant(start + ran * MINUTE, "time")} · ${ran} min · hosted by ${personName(host)}`;
  }
  return `${sessionWhen(session.startsAt)} · ${hostIsYou ? "you’re hosting" : `${personName(host)} hosting`}`;
}

/** "Thu 19:00": a session's day and time, short. */
export const shortWhen = (startsAt: string) => `${formatInstant(startsAt, "weekdayShort")} ${formatInstant(startsAt, "time")}`;

/** A schedule row's line (sheet #c8): "Thu 19:00 · 23 going" for the
 * next, the time alone for later ones, "58 min · 27 comrades · Summary"
 * for a past one (its time, when it had no reading room). */
export function scheduleLine(card: RoomSession, row: "next" | "later" | "past"): string {
  const when = shortWhen(card.session.startsAt);
  if (row === "past") {
    if (card.minutes === null) return when;
    return [`${card.minutes} min`, comradeCount(card.count), ...(card.summary.length ? ["Summary"] : [])].join(" · ");
  }
  return row === "next" ? `${when} · ${card.count} going` : when;
}

/** "23 going", "24 listening", "27 comrades joined". */
export function sessionPeople({ state, count }: Pick<RoomSession, "state" | "count">): string {
  if (state === "live") return `${count} listening`;
  if (state === "ended") return `${comradeCount(count)} joined`;
  return `${count} going`;
}

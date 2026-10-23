// Shapes shared by the group routes (server) and lib/groups/api.ts (client).

import type { Avatar } from "@/lib/avatar/avatar";
import type { MaterialSummary } from "@/lib/api/types";
import type { FeedItem } from "@/lib/community/feed";
import type { ProgressWord } from "@/lib/groups/progress";
import type { Comrade } from "@/lib/rooms/types";

export type GroupRole = "moderator" | "member";

export type GroupInfo = {
  id: string;
  slug: string;
  name: string;
  description: string;
  memberCount: number;
  /** Invite only: not listed, and joined by invite. */
  private?: boolean;
};

/** `GET /api/groups/{slug}`: the page header. `myRole` is null signed out or
 * not joined; display only, the routes authorise themselves. */
export type GroupPage = {
  group: GroupInfo;
  myRole: GroupRole | null;
  /** The viewer muted the group (false when they aren't in it). */
  muted: boolean;
  /** Comrades who read in the last 15 minutes, never the viewer (the room's
   * header, rooms-spec 4a). */
  readingNow: number;
};

/** `GET /api/groups`: one entry per group, with the viewer's membership. */
export type GroupSummary = GroupInfo & { joined: boolean };

export type GroupMember = {
  readerId: string;
  pseudonym: string;
  avatar: Avatar;
  role: GroupRole;
  joinedAt: string;
};

export const GROUP_NAME_MAX = 80;
export const GROUP_DESCRIPTION_MAX = 500;

export type GroupBookStatus = "current" | "next" | "done";

/** `GET /api/groups/{slug}/books`: one reading-list row (M9). Dates are
 * local days ("YYYY-MM-DD"). */
export type GroupBook = {
  material: MaterialSummary;
  status: GroupBookStatus;
  startsOn: string | null;
  endsOn: string | null;
  finishedOn: string | null;
  /** Sessions held on it (Done rows' "4 sessions"). */
  sessions: number;
};

/** `GET /api/groups/{slug}/notes`: one page of the Notes tab. The pinned
 * note, when there is one the viewer can read, leads the first page. */
/** A system item in the group feed (spec §4.3), copy frozen when posted. */
export type GroupMilestone = {
  id: string;
  kind: "session_held" | "book_finished" | "target_reached";
  materialId: string | null;
  title: string;
  detail: string | null;
  /** "19 of 24": the dots. */
  reached: number | null;
  total: number | null;
  createdAt: string;
};

/** The retired Notes tab's page: only the old e2e suites still read it, and
 * they go in rooms-tasks 7.4. */
export type GroupFeedPage = {
  items: FeedItem[];
  pinnedId: string | null;
  /** Milestones posted within this page's span of the feed. */
  milestones: GroupMilestone[];
  nextCursor: string | null;
};

/** This week's target (spec §4.2): a point in the current book by a day.
 * Percentages are of the book; days are local days in the group's zone. */
export type GroupTarget = {
  id: string;
  materialId: string;
  startPct: number;
  endPct: number;
  /** "Ch. 3" or "52%". */
  endLabel: string;
  /** "Ch. 3 of 5" on the reading list; null for a percentage target. */
  endChapter: number | null;
  chapterCount: number | null;
  startsOn: string;
  dueOn: string;
};

/** `GET /api/groups/{slug}/target`: everything the target card, the
 * Schedule's day rows, the Members tab's words and M7 need, in one call. */
export type TargetView = {
  /** Today in the group's timezone. */
  today: string;
  currentMaterialId: string | null;
  /** The running target on the current book; null once it's past due. */
  target: GroupTarget | null;
  /** Who set the running target (the card's "set by"). */
  setBy: string | null;
  /** Where a target set now on the current book starts (M7's "from last
   * week's stop"). */
  draftStartPct: number;
  memberCount: number;
  onTrack: number;
  /** Mean progress of members who've started the current book. */
  groupPct: number | null;
  /** The viewer's progress on the current book: null if not started; the
   * whole field is null when they aren't a member. */
  mine: { pct: number | null } | null;
  /** Each member's progress in words, by reader id (none without a target). */
  words: Record<string, ProgressWord | null>;
  /** Each member's percentage through the current book, null if not
   * started: Group info shows their chapter (rooms-spec §2). */
  progress: Record<string, number | null>;
  /** Together so far: targets the circle reached (§4.3), and the latest. */
  reached: { count: number; latest: string | null };
};

export type SessionRepeat = "once" | "weekly";

export const SESSION_TOPIC_MAX = 160;

/** One session (spec §3.2 M8): an occurrence; a weekly series is its
 * occurrences linked by `seriesId`. */
export type GroupSession = {
  id: string;
  seriesId: string | null;
  topic: string;
  materialId: string | null;
  sectionLabel: string | null;
  startsAt: string;
  repeat: SessionRepeat;
  /** The viewer's Remind me; null when they aren't a member. */
  remind: boolean | null;
  /** Past sessions: whether the viewer came ("You came"); null when they
   * aren't a member, and on upcoming ones. */
  attended: boolean | null;
};

/** The group's live room (spec §11 surfacing): "Ama and 9 comrades". A
 * book's standalone room has the same shape (MaterialRoom). */
export type GroupLiveRoom = {
  id: string;
  materialId: string;
  title: string;
  sessionId: string | null;
  starterName: string;
  starterId: string;
  startedAt: string;
  /** In the room now. */
  members: number;
  /** A few of them, for the card's faces. */
  people: Comrade[];
};

/** Who's on a session's card: its host, and the members still reminded
 * (Remind me is on unless turned off), a few of them by face. */
export type SessionPeople = { host: Comrade | null; going: number; people: Comrade[] };

/** `GET /api/groups/{slug}/sessions`: the session card, the Schedule's rows
 * and day rows, M8 and Manage, in one call. */
export type SessionsView = {
  /** The group's timezone: what its local days are in. */
  timezone: string;
  /** Not cancelled and not over, soonest first (on ones included). */
  upcoming: GroupSession[];
  /** The first upcoming session's card (rooms-spec #c4); null when none. */
  next: SessionPeople | null;
  /** Held, latest first. */
  past: GroupSession[];
  /** The reading room each past session had, by session id: how long it
   * ran and who came. A session held without a room has none. */
  runs: Record<string, { minutes: number; joined: number }>;
  /** Sessions held so far. */
  held: number;
  /** How many of them the viewer came to; null when they aren't a member. */
  attendedCount: number | null;
  live: GroupLiveRoom | null;
};

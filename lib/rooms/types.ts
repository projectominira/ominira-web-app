import type { AnnotationRange, MaterialSummary, Note } from "@/lib/api/types";
import type { FeedItem } from "@/lib/community/feed";
import type { GroupBookStatus, GroupMilestone, GroupSession, TargetView } from "@/lib/groups/types";
import type { StreakView } from "@/lib/streaks/types";

export type RoomKind = "group" | "book";

/** A person in a room: an avatar and a name. */
export type Comrade = Pick<Note["author"], "readerId" | "pseudonym" | "avatar">;

/** A note as a bubble: the feed item plus what the bubble shows around it.
 * `label` is the quote's cite ("Ch. 1, p. 27"), `excerpt` the quote. */
export type RoomNote = FeedItem & {
  /** "Ominira" on the official account, "Moderator" on a group moderator. */
  authorTag: string | null;
  /** Written in the reader on a passage: "From the reader · Ch. 1". */
  fromReader: boolean;
  /** The pin's label ("Passage of the day"); null when not pinned. */
  pinned: string | null;
  /** The passage of the day's question, on its note. */
  question: string | null;
  /** All replies; `replies` holds the latest page of them. */
  replyCount: number;
  /** The footer's avatars and names, latest first. */
  repliers: Comrade[];
  /** Distinct comrades in the thread, for "and 12 others". */
  replierCount: number;
  /** Distinct comrades who replied in the last 10 minutes (spec §2). */
  replyingNow: number;
  /** Comrades' replies since you last read the room (lib/rooms/unread). */
  newReplies: number;
  /** "Also in Rodney Reading Group": a book note that's in the group too. */
  alsoIn: string | null;
};

/** `GET /api/community/notes/{id}`: a note on its own page (/note/[id]).
 * `focusId`: the reply asked for, when it was one; `moderator`: the viewer
 * moderates the group it was posted in. */
export type NoteThread = RoomNote & { focusId: string | null; moderator: boolean };

/** A reading room as a card in the stream. */
export type RoomSession = {
  session: GroupSession;
  state: "upcoming" | "live" | "ended";
  host: string;
  hostId: string;
  /** Who's on the card's avatar stack. */
  people: Comrade[];
  /** Upcoming: going. Live: listening. Ended: joined. */
  count: number;
  /** Live: "Ada.O reading Ch. 5". */
  reading: string | null;
  /** Live: minutes since it started. Ended: how long it ran. */
  minutes: number | null;
  /** Ended: the summary's lines. */
  summary: string[];
};

/** The week's target as a card: the target view, plus its words. */
export type RoomTarget = {
  view: TargetView;
  bookTitle: string;
  setBy: string;
  /** "Ch. 4": with the view's endLabel, the card's "Ch. 4–6". Null until
   * the book's chapters are known. */
  startLabel: string | null;
  /** "Ch. 5" (or "58%" in a book with no chapters): where the viewer is. */
  myLabel: string | null;
};

/** One item in a room's stream, oldest first. */
export type RoomItem =
  | { t: "day"; day: string }
  | { t: "unread"; count: number }
  /** `actor` is the person who made the change; null for a room's own
   * line ("Reading room ended"). `ref` is what it's about (a target,
   * session or room): a card is placed after its line (lib/rooms/timeline). */
  | {
      t: "system";
      id: string;
      actor: string | null;
      text: string;
      em: string | null;
      post: string | null;
      mic: boolean;
      at: string;
      ref?: string | null;
      /** A group event's actor id: group events count as unread
       * (lib/rooms/unread), a book room's lines don't. */
      eventBy?: string | null;
    }
  | { t: "joins"; id: string; comrades: Comrade[]; at: string }
  /** `book`: the finished book's title, set in italics on the card. */
  | { t: "milestone"; milestone: GroupMilestone; book: string | null }
  | { t: "target"; target: RoomTarget }
  | { t: "session"; card: RoomSession }
  | { t: "note"; note: RoomNote }
  /** At the bottom: a note with comrades' replies since you last read the
   * room, wherever the note is. */
  | { t: "replied"; replied: RepliedNote }
  /** A highlight in a book's room: a public one, or your own private one.
   * `href` opens the reader at its line. */
  | {
      t: "highlight";
      id: string;
      author: Note["author"];
      visibility: Note["visibility"];
      excerpt: string;
      label: string;
      ranges: AnnotationRange[];
      href: string | null;
      at: string;
    }
  | { t: "empty" };

/** A note with comrades' replies since you last read the room: `count`
 * of them, by `repliers` (latest first), the last `at`. */
export type RepliedNote = { id: string; author: Comrade; text: string; repliers: Comrade[]; replierCount: number; count: number; at: string };

/** `GET /api/groups/{slug}/stream`, `GET /api/materials/{id}/stream`: one
 * page, oldest first; `nextCursor` asks for the page before it.
 * `lastReadAt` (room_reads, else when you joined; the first page only)
 * places the unread divider (lib/rooms/unread); `replied` (the first page
 * only) the notes with new replies, latest last. */
export type RoomStreamPage = { items: RoomItem[]; nextCursor: string | null; lastReadAt: string | null; replied: RepliedNote[] };

/** A book room's header (compact and expanded). */
export type BookRoomHeader = {
  title: string;
  author: string;
  cover: string | null;
  /** The viewer's progress; null when not started. */
  pct: number | null;
  /** Where the viewer is, as Today has it ("Ch. 2 · The Pitfalls…"); null
   * when not started, finished, or in a book with no chapters. */
  chapter: string | null;
  cta: string;
  /** The CTA resumes listening; the switch then offers reading. */
  listening: boolean;
  noteCount: number;
  /** Everyone reading, the viewer too: the details column lists them all. */
  everyone: { comrade: Comrade }[];
  everyoneCount: number;
  description: string;
  /** "1961 · 251 pages · Audiobook 9 h 40 min" */
  meta: string;
  /** `num` is the chapter's number ("4"); `pct` how far the viewer is;
   * `id` its section, to open it in the reader. */
  contents: { num: string; label: string; pct: number | null; id?: string }[];
};

/** A book on the group's reading list (sheet #c8): its words are the
 * route's ("Walter Rodney · group is mostly on Ch. 5"). */
export type ReadingListRow = { id: string; status: GroupBookStatus; title: string; cover: string | null; sub: string; pct: number | null };

/** A member in Group info: a role tag for the team, and how far through
 * the current book they are; null if not started. */
export type MemberRow = { comrade: Comrade; role: string | null; pct?: number | null };

/** One status in Home's strip (home-spec §2 Home 1), in the strip's order:
 * a room live now (a group's too, once groups are in). */
export type StatusItem = {
  id: string;
  kind: RoomKind;
  /** The room's full name (a group's letter comes from it); `label` is
   * the strip's ("Study group"). */
  name: string;
  label: string;
  cover: string | null;
  reason: "live" | "reading";
  /** Listening (live) or read in the last 24 hours. */
  count: number;
  /** The book: a reading one offers to start its room. Null for a group. */
  materialId: string | null;
  /** The room live on it, to join. */
  room: { id: string; title: string } | null;
};

/** A public book you could start a reading room on. `readers`: comrades
 * (never you) who read it in the last day, invited when it starts. */
export type StartableBook = { material: MaterialSummary; readers: number };

/** `GET /api/rooms/suggestions` — "Start a room"'s books. `mine`: every
 * public book you're currently reading, latest first; `today`: those
 * comrades read in the last day, the busiest first. */
export type RoomSuggestions = { mine: StartableBook[]; today: StartableBook[] };

/** A book room as a chat row on Home (`RoomRow`, home-spec §2): its latest
 * note you can see. */
/** A room's latest note, reply or group action, as its row previews it.
 * An action's `text` follows its actor ("scheduled Ch. 4"); a milestone's
 * has none (`who` empty). */
export type RoomLast = { who: string; avatar: Comrade["avatar"]; mine: boolean; kind: "note" | "reply" | "action"; text: string; at: string };

export type RoomRowView = {
  slug: string;
  name: string;
  cover: string | null;
  last: RoomLast;
  /** Comrades' notes and replies since you last read the room (or, never
   * opened, since you joined). */
  unread: number;
  /** Listening, while a reading room is on. */
  live: number | null;
  /** Comrades reading it now (never you). */
  readingNow: number;
};

/** A study group as a card on Home: what it's reading and how far the
 * group has got, when it next meets, and what's new. */
export type GroupCardView = {
  slug: string;
  name: string;
  members: number;
  joined: boolean;
  /** The current book; `pct` is the members' mean, `chapter` where that
   * falls ("Ch. 4"). Null with nothing on the list yet. */
  book: { title: string; cover: string | null; pct: number | null; chapter: string | null } | null;
  /** The next session's start (or the one on now); null with none planned. */
  nextAt: string | null;
  /** Comrades' notes, replies and group actions (never joins) since you
   * last read the group (or, never opened, since you joined it). */
  unread: number;
  /** Listening, while the group's reading room is on. */
  live: number | null;
  /** The group room's latest note, reply or action; null for a group you're
   * not in, or one with no notes yet. */
  last: RoomLast | null;
};

/** The book you're reading: where you left off, and both ways back in. */
export type CurrentBook = { material: MaterialSummary; chapter: string | null; pct: number; listening: boolean; readHref: string; listenHref: string };

/** Today's reading against the goal on the streak card. */
export type StreakToday = { minutes: number; goal: number; collectiveMinutes: number };

/** A featured book: "V. I. Lenin · new". */
export type FeaturedRow = { material: MaterialSummary; sub: string };

/** `GET /api/auth/me/home` (home-spec §5.2). Signed out, it's the public
 * hub: no streak, no current book, and the rooms' public notes. */
export type HomeView = {
  strip: StatusItem[];
  /** The book you're reading; null for a new reader. */
  current: CurrentBook | null;
  streak: StreakView | null;
  today: StreakToday | null;
  /** Your groups, latest joined first; while you're in fewer than two,
   * groups to join after them. */
  groups: GroupCardView[];
  /** Book rooms with a note you can read, the latest first. */
  rooms: RoomRowView[];
  featured: FeaturedRow[];
  /** Today's passage of the day; null until one is set. */
  passage: HomePassage | null;
};

/** The passage of the day on Home: its question, the quote and where it is. */
export type HomePassage = {
  question: string;
  excerpt: string;
  cite: string;
  answers: number;
  /** The reader, at the quote. */
  href: string;
};

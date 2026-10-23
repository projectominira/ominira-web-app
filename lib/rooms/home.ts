// Home's rules (home-spec §2, §5.1; rooms-spec §2 Home): the streak's
// week, words and goal; the strip; a book room row's preview, signal and
// time; where you are in your book. Pure.

import type { ChapterEnd } from "@/lib/groups/progress";
import { comradeName } from "@/lib/reader/authorDisplay";
import type { StreakView } from "@/lib/streaks/types";
import { formatShortTimeAgo } from "@/lib/time/relative";
import { addDays, weekdayOf, type LocalDay } from "@/lib/time/zone";
import type { RoomKind, RoomRowView, StatusItem, StreakToday } from "./types";

export type ChainDay = { day: LocalDay; letter: string; state: "done" | "today" | "next" };

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** This week, Monday to Sunday: read days done, today ringed until read. */
export function weekChain(view: Pick<StreakView, "today" | "days">): ChainDay[] {
  const monday = addDays(view.today, -weekdayOf(view.today));
  const read = new Set(view.days);
  return LETTERS.map((letter, i): ChainDay => {
    const day = addDays(monday, i);
    return { day, letter, state: read.has(day) ? "done" : day === view.today ? "today" : "next" };
  });
}

/** The ring's share of today's goal, 0 to 1. */
export const goalShare = ({ minutes, goal }: Pick<StreakToday, "minutes" | "goal">) => (goal > 0 ? Math.min(1, minutes / goal) : 0);

/** "10,100" */

export type StreakCopy = { title: string; sub: string };

export function streakCopy(view: StreakView, today: StreakToday): StreakCopy {
  const { state } = view;
  // TodayCard.dc.html's words; it has no milestone state.
  const left = Math.max(0, today.goal - today.minutes);
  const fresh = state.kind === "none" || state.kind === "ended";
  // Any reading counts the day; the goal is apart from the streak.
  const goal =
    left === 0
      ? "Goal met for today."
      : state.kind === "kept"
        ? `${goalLabel(left)} left of today's goal.`
        : fresh
          ? "Read today to start one."
          : `Start today's reading to make it day ${state.days + 1}.`;
  return { title: fresh ? "Start a streak" : `${state.days}-day streak`, sub: goal };
}

/** The daily goal's range and step (what the server accepts): 30 min to
 * 8 hr in quarter hours. */
export const GOAL = { min: 30, max: 480, step: 15, fallback: 60 } as const;

/** A reader who never set one has the fallback. */
export const dailyGoal = (stored: number | null) => stored ?? GOAL.fallback;

/** A goal Adjust can set: in range, on a step. */
export const isGoal = (m: number) => Number.isInteger(m) && m >= GOAL.min && m <= GOAL.max && m % GOAL.step === 0;

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** "45 minutes", "1 hour", "2 hours 30 minutes". */
export function goalLabel(m: number): string {
  if (m < 60) return plural(m, "minute");
  const rest = m % 60;
  return `${plural(Math.floor(m / 60), "hour")}${rest ? ` ${plural(rest, "minute")}` : ""}`;
}

/** Today's reading inside the ring: "45" minutes, or "1:15" hours. */
export function ringTime(m: number): { value: string; unit: string } {
  if (m < 60) return { value: `${m}`, unit: m === 1 ? "minute" : "minutes" };
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return { value: rest ? `${h}:${`${rest}`.padStart(2, "0")}` : `${h}`, unit: m === 60 ? "hour" : "hours" };
}

/** Adjust daily goal's quick picks, in minutes. */
export const GOAL_PRESETS = [30, 60, 120, 240] as const;

/** `m` into the goal's range, `steps` quarter hours on. */
export const goalStep = (m: number, steps = 0) => Math.min(GOAL.max, Math.max(GOAL.min, m + steps * GOAL.step));

/** Whole minutes in a day's seconds. */
export const toMinutes = (seconds: number) => Math.floor(seconds / 60);

// ---- The status strip (home-spec §2 Home 1, §5.1) ----

/** "Reading now": a position saved this recently, not finished. The shelf's
 * "currently reading" is any unfinished book; this is the strip's live sense. */
export const READING_NOW_MS = 15 * 60_000;

/** The strip's window: rooms read in the last 24 hours. */
export const STRIP_MS = 24 * 60 * 60_000;

/** A room's signals for the strip. `live` is how many are listening while
 * a reading room is on; `reading`, how many read it in the last 24 hours. */
export type StripCandidate = Pick<StatusItem, "id" | "kind" | "name" | "cover" | "materialId" | "room"> & { live: number | null; reading: number };

/** The group's label on the strip. */
export const GROUP_STRIP_LABEL = "Study group";

/**
 * The status strip (spec §2 Home 1): rooms live now or read in the last 24
 * hours. The group first when it qualifies, then books: live before
 * reading, the busiest first within each.
 */
export function buildStrip(group: StripCandidate | null, books: StripCandidate[]): StatusItem[] {
  const item = ({ live, reading, ...c }: StripCandidate): StatusItem | null =>
    live !== null ? { ...c, label: c.name, reason: "live", count: live } : reading > 0 ? { ...c, label: c.name, reason: "reading", count: reading } : null;
  const ranked = books.flatMap((c) => item(c) ?? []);
  ranked.sort((a, b) => Number(b.reason === "live") - Number(a.reason === "live") || b.count - a.count);
  const head = group && item(group);
  return [...(head ? [{ ...head, label: GROUP_STRIP_LABEL }] : []), ...ranked];
}

/** A status's ring and caption: "23 listening", "8 reading". */
export const statusLook = (s: Pick<StatusItem, "reason" | "count">) =>
  s.reason === "live" ? { ring: "live" as const, caption: `${s.count} listening` } : { ring: "brand" as const, caption: `${s.count} reading` };

// ---- Book rooms (home-spec §2 Room row, §5.1) ----

/** Rooms as a chat list: the latest note first, rooms with none last, in
 * their given order. */
export function byLatest<T extends { last: { at: string } | null }>(rows: T[]): T[] {
  const at = (r: T) => (r.last ? Date.parse(r.last.at) : -Infinity);
  return [...rows].sort((a, b) => at(b) - at(a));
}

/** How a row names a note's author: "Comrade" (the app's convention) and
 * the pseudonym, or its first word when that's over 18 characters
 * ("Thandiwe of the Lagos–Johannesburg Reading Circle" → "Comrade
 * Thandiwe"). A pseudonym's own "Comrade" isn't doubled. */
export function previewName(pseudonym: string): string {
  const name = pseudonym.replace(/^comrade\s+/i, "").trim();
  return comradeName(name.length > 18 ? name.split(/\s+/)[0] : name);
}

/** A row's preview of a note: its words, or what it is when it has none. */
export const previewText = (row: { content: unknown; kind: string }) =>
  (row.content as { text?: string } | null)?.text || (row.kind === "voice" ? "Voice note" : "Shared a passage");

/** Who a row's last note is from: "Comrade Ama", or "You". */
export function rowSender(last: RoomRowView["last"]): string {
  return last.mine ? "You" : previewName(last.who);
}

/** A row's signal line: "Live now · 23 listening", "12 reading now", else
 * none. */
export function rowSignal(r: Pick<RoomRowView, "live" | "readingNow">): string | null {
  if (r.live !== null) return `Live now · ${r.live} listening`;
  return r.readingNow > 0 ? `${r.readingNow} reading now` : null;
}

/** A room's top bar signal: "Live now · 23 listening", "12 reading now",
 * else what it is ("Study group", "Book room"). Groups are readers' own now,
 * so none says who runs it. */
export function roomSignal({ kind, live, readingNow }: { kind: RoomKind; live: number | null; readingNow: number }): string {
  if (live !== null) return `Live now · ${live} listening`;
  if (readingNow > 0) return `${readingNow} reading now`;
  return kind === "group" ? GROUP_STRIP_LABEL : "Book room";
}

/** A chat list's time: the short relative form ("now", "14m", "3h", "2d",
 * "2w", "3mo"), same as note timestamps elsewhere in the app. */
export function chatTime(at: string, now: number): string {
  return formatShortTimeAgo(Date.parse(at), now);
}

/** Where you are in the book you're reading (Today card): "Ch. 3 · The
 * Pitfalls of National Consciousness" from a "Chapter 3: …" label, "Ch. 5"
 * from a bare one, the label itself when it isn't numbered; null in a book
 * with no chapters. */
export function chapterLine(ends: ChapterEnd[], pct: number): string | null {
  if (ends.length === 0) return null;
  const label = (ends.find((e) => e.endPct > pct) ?? ends[ends.length - 1]).label.trim();
  const m = /^chapter\s+([\w.]+?)[.:]?(?:\s*[.:–—-]\s*|\s+)(.+)$/i.exec(label);
  if (m) return `Ch. ${m[1]} · ${m[2]}`;
  const bare = /^chapter\s+([\w.]+)/i.exec(label);
  return bare ? `Ch. ${bare[1].replace(/[.:]$/, "")}` : label;
}

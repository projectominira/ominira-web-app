// How rooms name people (rooms-spec §4, sheet #c1, #c3): by pseudonym alone,
// as everywhere (no "Comrade" prefix since 2026-10-27). The short lists:
// "Kemi, Tunde and 12 others". Pure.

import type { Comrade } from "./types";

/** The official account's tag (`RoomNote.authorTag`): its avatar is the mark. */
export const OFFICIAL_TAG = "Ominira";

/** "Kemi Reads" -> "Kemi": the footer's short form. */
export const firstName = (pseudonym: string) => pseudonym.split(/\s+/)[0];

/** Everyone when there are three or fewer, else the first two and "and N
 * others". `names` holds at least the first two of `total`. */
export function listNames(names: string[], total: number): string {
  if (total <= 3) return names.join(", ");
  const others = total - 2;
  return `${names.slice(0, 2).join(", ")} and ${others} other${others === 1 ? "" : "s"}`;
}

/** A group's head, as WhatsApp's: "Kemi, Tunde, You". */
export function memberLine(members: { readerId: string; pseudonym: string }[], viewerId: string | null): string {
  const others = members.filter((m) => m.readerId !== viewerId).map((m) => firstName(m.pseudonym.replace(/^comrade\s+/i, "")));
  return [...others, members.some((m) => m.readerId === viewerId) && "You"].filter(Boolean).join(", ");
}

/** Short names in a list: "Kemi". */
export const shortName = (pseudonym: string) => firstName(pseudonym.replace(/^comrade\s+/i, ""));

/** The replies footer: first names, latest first; the viewer is "you". */
export const replierNames = (repliers: Comrade[], replierCount: number, viewerId: string | null) =>
  listNames(
    repliers.map((c) => (c.readerId === viewerId ? "you" : shortName(c.pseudonym))),
    replierCount,
  );

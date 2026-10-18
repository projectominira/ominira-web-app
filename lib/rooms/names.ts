// How rooms name people (rooms-spec §4, sheet #c1, #c3): with the app's
// "Comrade" prefix, as everywhere (user, 2026-10-13). The bubble's author,
// and the short lists: "Comrade Kemi, Comrade Tunde and 12 others". Pure.

import { comradeName } from "@/lib/reader/authorDisplay";
import type { Comrade } from "./types";

/** The official account's tag (`RoomNote.authorTag`): its avatar is the mark. */
export const OFFICIAL_TAG = "Ominira";

/** A person as rooms show them: "Comrade Kemi Reads", as everywhere in the
 * app (`comradeName`); the official account is just "Ominira". */
export const personName = (pseudonym: string, official = false) => (official ? pseudonym : comradeName(pseudonym));

/** "Kemi Reads" -> "Kemi": the footer's short form. */
export const firstName = (pseudonym: string) => pseudonym.split(/\s+/)[0];

/** Everyone when there are three or fewer, else the first two and "and N
 * others". `names` holds at least the first two of `total`. */
export function listNames(names: string[], total: number): string {
  if (total <= 3) return names.join(", ");
  const others = total - 2;
  return `${names.slice(0, 2).join(", ")} and ${others} other${others === 1 ? "" : "s"}`;
}

/** Short names in a list: "Comrade Kemi". */
export const shortName = (pseudonym: string) => comradeName(firstName(pseudonym.replace(/^comrade\s+/i, "")));

/** The replies footer: first names, latest first; the viewer is "you". */
export const replierNames = (repliers: Comrade[], replierCount: number, viewerId: string | null) =>
  listNames(
    repliers.map((c) => (c.readerId === viewerId ? "you" : shortName(c.pseudonym))),
    replierCount,
  );

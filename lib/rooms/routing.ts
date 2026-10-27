// Where a note on a book goes (rooms-spec §5.3). There's no picker: the
// only choice is the lock. Pure; app/api/community/notes applies it, and
// the reader's composer says it (routeLine, sentLine).


export type NoteRoute = { visibility: "public" | "private"; groupId: string | null; mentionIds: string[] };

/**
 * Unlocked: public on the book, and also in the author's group when its
 * reading list has the book ("Also in {group}"); tags go with it. Locked:
 * only the author sees it, so it reaches no group and tags are off.
 * `groupsWithBook` are the author's groups that have the book, in the
 * order they joined them; the first wins.
 */
export function routeNote({ locked, mentionIds, groupsWithBook }: { locked: boolean; mentionIds: string[]; groupsWithBook: string[] }): NoteRoute {
  if (locked) return { visibility: "private", groupId: null, mentionIds: [] };
  return { visibility: "public", groupId: groupsWithBook[0] ?? null, mentionIds };
}

/** The group a reader's unlocked note on the book also goes to: the first of
 * `groupsWithBook`, and whether the book is its current one. */
export type NoteGroup = { name: string; slug: string; current: boolean };

/** "Kemi Reads is" / "3 comrades are": who the note tags, as the lines say it. */
function taggedWho(tagged: string[]): string | null {
  if (tagged.length === 0) return null;
  return tagged.length === 1 ? `${tagged[0]} is` : `${tagged.length} comrades are`;
}

/** The "where it goes" line under the writing (frames 12b, 13b, 13c). It
 * changes as you tag someone or lock the note. `tagged` are pseudonyms. */
export function routeLine({ locked, group, tagged }: { locked: boolean; group: NoteGroup | null; tagged: string[] }): string {
  if (locked) return "Only you. It stays in this book’s room, marked private, and under Only you.";
  const who = taggedWho(tagged);
  if (!group) return `Shows in this book’s room.${who ? ` ${who} tagged.` : ""}`;
  const where = group.current ? "where this is the current book" : "where it’s on the reading list";
  return `Shows here and in ${group.name}, ${where}.${who ? ` ${who} tagged in both.` : ""}`;
}

/** The toast once it's sent. */
export function sentLine({ locked, group, tagged }: { locked: boolean; group: NoteGroup | null; tagged: string[] }): string {
  if (locked) return "Saved privately in this book’s room";
  const who = taggedWho(tagged);
  if (!group) return `Posted in this book’s room${who ? `. ${who} tagged.` : ""}`;
  return `Posted here and in ${group.name}${who ? `. ${who} tagged in both.` : ""}`;
}

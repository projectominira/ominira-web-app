import type { Note } from "@/lib/api/types";
import { WHOLE_CIRCLE } from "@/lib/community/mentionText";

/** The "@Name" runs a note's text may tag: its mentions, and Whole circle
 * on a group note. */
export function noteMentionNames(note: Note): string[] {
  const names = note.mentions.map((m) => m.pseudonym);
  return note.group ? [...names, WHOLE_CIRCLE] : names;
}

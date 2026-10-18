// How mentions sit in a note's text (studygroup-spec.md §3.3): picking a
// comrade writes "@Name" into the text, and the note's own `mentions` list
// says which "@Name" runs are real tags. Pure; shared by the composer and
// NoteContent.

/** The moderators' "Whole circle" suggestion, written into the text as-is. */
export const WHOLE_CIRCLE = "Whole circle";

export const mentionToken = (name: string) => `@${name}`;

/** Where a freshly typed @ sits, when `next` is `text` plus one "@" just
 * before the caret, at the start or after whitespace (not an email's @).
 * Null otherwise. */
export function typedMention(text: string, next: string, caret: number): number | null {
  const at = caret - 1;
  if (next.length !== text.length + 1 || next[at] !== "@") return null;
  if (next.slice(0, at) + next.slice(caret) !== text) return null;
  return at === 0 || /\s/.test(next[at - 1]) ? at : null;
}

/** Writes "@Name " at `at`, with a space before it when it would touch a
 * word. Returns the new text and where the next pick goes. */
export function insertMention(text: string, at: number, name: string): { text: string; caret: number } {
  const lead = at > 0 && !/\s/.test(text[at - 1]) ? " " : "";
  const token = `${lead}${mentionToken(name)} `;
  return { text: text.slice(0, at) + token + text.slice(at), caret: at + token.length };
}

/** An inline picker (the rooms' input): the "@query" typed at `at`, up to
 * the caret. Null once the @ is gone, the caret left it, or a space ends it. */
export function inlineQuery(text: string, at: number, caret: number): string | null {
  if (text[at] !== "@" || caret <= at) return null;
  const query = text.slice(at + 1, caret);
  return /\s/.test(query) ? null : query;
}

/** Swaps the inline "@query" at `at` for `insert` (a "@Name" or a chapter),
 * spaced off a word, with a space after. */
export function replaceInline(text: string, at: number, query: string, insert: string): { text: string; caret: number } {
  const rest = text.slice(at + 1 + query.length);
  const lead = at > 0 && !/\s/.test(text[at - 1]) ? " " : "";
  const token = `${lead}${insert} `;
  return { text: text.slice(0, at) + token + rest.replace(/^ /, ""), caret: at + token.length };
}

/** Whether "@Name" is still in the text; a tag whose name was edited away
 * isn't sent. */
export const hasMention = (text: string, name: string) => text.includes(mentionToken(name));

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Takes every "@Name" (and the space after it) out of the text: untagging
 * from the picker. */
export const removeMention = (text: string, name: string) => text.replace(new RegExp(`${escape(mentionToken(name))} ?`, "g"), "");

/** Splits text into plain runs and tagged "@Name" runs, for display. */
export function splitMentions(text: string, names: string[]): Array<string | { mention: string }> {
  if (names.length === 0) return [text];
  const tokens = new Set(names.map(mentionToken));
  // Longest first, so "@Kofi Writes" wins over "@Kofi".
  const alternatives = [...tokens].sort((a, b) => b.length - a.length).map(escape);
  return text
    .split(new RegExp(`(${alternatives.join("|")})`))
    .filter((part) => part !== "")
    .map((part) => (tokens.has(part) ? { mention: part } : part));
}

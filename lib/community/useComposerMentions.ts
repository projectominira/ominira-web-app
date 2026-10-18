"use client";

import { useState, type RefObject } from "react";
import { useMentionCandidates } from "@/lib/community/useMentions";
import { WHOLE_CIRCLE, hasMention, inlineQuery, insertMention, removeMention, replaceInline, typedMention } from "@/lib/community/mentionText";
import { MAX_MENTIONS, type MentionCandidate } from "@/lib/community/mentionTypes";

export type Tagged = Pick<MentionCandidate, "readerId" | "pseudonym" | "avatar">;

/**
 * Mentions for any composer (Home, a group, a book's notes): typing @ or
 * the @ tool opens the tag picker (TagPicker) at the caret, and each pick
 * writes "@Name" there. The composer owns the text; this owns the picker
 * and the tags. Off (`enabled: false`) it's inert.
 *
 * `inline` (a room's input, Rooms v4 sheet #c6): the @ stays in the text and
 * the query is what's typed after it, so there's no search field; a pick
 * replaces "@query" and closes the picker.
 */
export function useComposerMentions({
  text,
  setText,
  inputRef,
  enabled = true,
  inline = false,
  groupSlug = null,
  wholeCircle = null,
  initialTagged = [],
}: {
  text: string;
  setText: (text: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  enabled?: boolean;
  inline?: boolean;
  groupSlug?: string | null;
  /** Moderators posting to a group: how many Whole circle notifies. */
  wholeCircle?: number | null;
  /** Already tagged in the starting text (the gallery's frames). */
  initialTagged?: Tagged[];
}) {
  const [tagged, setTagged] = useState<Tagged[]>(initialTagged);
  // The open picker: where picks go in the text, and its search.
  const [picker, setPicker] = useState<{ at: number; query: string } | null>(null);
  const picking = enabled && picker !== null;
  const { data: candidates = [] } = useMentionCandidates(picking ? picker.query : null, groupSlug);

  const kept = tagged.filter((t) => hasMention(text, t.pseudonym));
  const keptIds = new Set(kept.map((t) => t.readerId));
  const circle = wholeCircle !== null && hasMention(text, WHOLE_CIRCLE);
  const offerCircle =
    picking && wholeCircle !== null && !circle && WHOLE_CIRCLE.toLowerCase().includes(picker.query.toLowerCase()) ? wholeCircle : null;

  function caretTo(at: number) {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(at, at);
    });
  }

  /** Inline: swaps "@query" for `insert` and closes. */
  function place(insert: string) {
    if (!picker) return;
    const done = replaceInline(text, picker.at, picker.query, insert);
    setText(done.text);
    setPicker(null);
    caretTo(done.caret);
  }

  function tag(name: string, who?: Tagged) {
    if (!picker || (who && kept.length >= MAX_MENTIONS)) return;
    if (who && !tagged.some((t) => t.readerId === who.readerId)) setTagged((list) => [...list, who]);
    if (inline) return place(`@${name}`);
    const done = insertMention(text, Math.min(picker.at, text.length), name);
    setText(done.text);
    setPicker({ at: done.caret, query: "" });
  }

  function close() {
    const at = picker ? Math.min(picker.at + (inline ? 1 + picker.query.length : 0), text.length) : text.length;
    setPicker(null);
    caretTo(at);
  }

  return {
    picking,
    pickerQuery: picker?.query ?? "",
    setPickerQuery(query: string) {
      setPicker((p) => p && { ...p, query });
    },
    /** The @ tool: opens the picker at the caret, or closes it. */
    togglePicker() {
      if (picker) return close();
      const caret = inputRef.current?.selectionStart ?? text.length;
      if (!inline) return setPicker({ at: caret, query: "" });
      // Inline: the @ tool types the @.
      const lead = caret > 0 && !/\s/.test(text[caret - 1]) ? " " : "";
      setText(`${text.slice(0, caret)}${lead}@${text.slice(caret)}`);
      setPicker({ at: caret + lead.length, query: "" });
      caretTo(caret + lead.length + 1);
    },
    closePicker: close,
    /** The picker's matches: anyone not tagged yet. */
    pickable: picking ? candidates.filter((c) => !keptIds.has(c.readerId)) : [],
    offerCircle,
    /** Who's tagged, still in the text. */
    kept,
    mentionReaderIds: kept.map((t) => t.readerId),
    circle,
    pick: (c: MentionCandidate) => tag(c.pseudonym, { readerId: c.readerId, pseudonym: c.pseudonym, avatar: c.avatar }),
    pickCircle: () => tag(WHOLE_CIRCLE),
    /** Inline: writes plain text there instead, a chapter ("Ch. 5"). */
    pickText: place,
    /** Untags: takes their "@Name" out of the text. */
    untag(name: string) {
      setText(removeMention(text, name));
    },
    /** The textarea's onChange: a freshly typed @ opens the picker there
     * instead of landing in the text. */
    onChange(value: string) {
      const caret = inputRef.current?.selectionStart ?? value.length;
      if (inline && enabled) {
        setText(value);
        if (picker) {
          const query = inlineQuery(value, picker.at, caret);
          setPicker(query === null ? null : { at: picker.at, query });
        } else {
          const at = typedMention(text, value, caret);
          if (at !== null) setPicker({ at, query: "" });
        }
        return;
      }
      const at = enabled && !picker ? typedMention(text, value, caret) : null;
      if (at === null) return setText(value);
      setText(value.slice(0, at) + value.slice(at + 1));
      setPicker({ at, query: "" });
    },
    reset() {
      setTagged([]);
      setPicker(null);
    },
  };
}

export type ComposerMentions = ReturnType<typeof useComposerMentions>;

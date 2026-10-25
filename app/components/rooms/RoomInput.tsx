"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { AtSign, SendHorizontal } from "lucide-react";
import { splitMentions } from "@/lib/community/mentionText";
import type { MentionCandidate } from "@/lib/community/mentionTypes";
import { useComposerMentions, type Tagged } from "@/lib/community/useComposerMentions";
import { personName } from "@/lib/rooms/names";
import { TEAM_TAG } from "@/lib/rooms/timeline";
import type { Comrade } from "@/lib/rooms/types";
import { COMPOSER_TOOL } from "@/app/components/reader/notes/ComposerBox";
import RoomAvatar from "./RoomAvatar";

// A room's input (home-spec §2 Composer, Room.dc.html), a chat bar as in
// a messaging app: a pill (white, a lifted grey in dark) with @ on the
// left, text that grows as you write, and a round send at its right end
// that turns brand when there's text. Typing @ (or the @ button) floats
// the picker above the bar: comrades, then chapters.

/** The text's box, shared by the field and its mirror so both lay the text
 * out identically — the same thin scrollbar's gutter kept in both, so the
 * field can scroll without its lines wrapping apart from the mirror's.
 * max-md: 16px, as globals.css sets every field there (iOS zoom). */
const TEXT = "om-scroll [scrollbar-gutter:stable] pr-2 pl-0.5 py-[7px] font-sans text-[15px]/[22px] font-normal whitespace-pre-wrap break-words max-md:text-[16px]";

/** Enter sends only where there's a real keyboard; on a phone it's a new line. */
export const hasKeyboard = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/** The field alone, controlled. Tagged "@Name" runs show in brand through a
 * mirror behind the field's transparent text. The mirror must lay text out
 * exactly as the field does (same weight, same wrap), or the caret drifts.
 * It also shows the placeholder, on one line cut with an ellipsis (a long
 * book title on a phone), which a textarea's own placeholder can't do. */
export function RoomField({
  value,
  onChange,
  placeholder,
  mentions = [],
  atOpen = false,
  inputRef,
  onAt,
  onSend,
  onKeyDown,
  maxLength,
  autoFocus = false,
  canSend = !!value.trim(),
  tools,
  below,
  docked = false,
}: {
  value: string;
  maxLength?: number;
  autoFocus?: boolean;
  /** Lit send; the text alone by default. */
  canSend?: boolean;
  onChange?: (value: string) => void;
  placeholder: string;
  /** Names tagged in the text. */
  mentions?: string[];
  atOpen?: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  onAt?: () => void;
  onSend?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Quiet buttons beside send. */
  tools?: ReactNode;
  /** A row inside the box, under the text (the share switch), shown
   * while writing. */
  below?: ReactNode;
  /** In a room's footer: on a phone the bar is the footer itself, edge to
   * edge, with no box of its own. */
  docked?: boolean;
}) {
  const mirror = useRef<HTMLDivElement>(null);
  const own = useRef<HTMLTextAreaElement>(null);
  const input = inputRef ?? own;
  const sync = () => {
    if (mirror.current && input.current) mirror.current.scrollTop = input.current.scrollTop;
  };
  useLayoutEffect(sync, [value, input]);

  return (
    <div
      className={`group/box flex flex-col rounded-sm border border-[var(--color-app-border)] bg-[var(--color-app-composer)] p-1 text-[var(--color-app-text)] shadow-sm transition-colors duration-150 ease-out focus-within:border-sand-300 ${
        docked ? "max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none" : ""
      }`}
    >
      <div className={`flex items-end ${onAt ? "" : "pl-3"}`}>
        {onAt && (
          <button
            type="button"
            aria-label="Tag a comrade or chapter"
            aria-expanded={atOpen}
            onClick={onAt}
            className={`${COMPOSER_TOOL} m-0.5 !size-8 !min-w-8 !rounded-full !px-0 ${atOpen ? "!bg-brand-50 !text-[var(--color-app-brand)]" : ""}`}
          >
            <AtSign size={17} strokeWidth={2} aria-hidden />
          </button>
        )}
        <div className="relative min-w-0 flex-1">
          <div aria-hidden ref={mirror} className={`pointer-events-none absolute inset-0 overflow-hidden ${TEXT}`}>
            {!value && <span className="block truncate text-[var(--color-app-text-muted)]">{placeholder}</span>}
            {splitMentions(value, mentions).map((run, i) =>
              typeof run === "string" ? (
                run
              ) : (
                <span key={i} className="text-[var(--color-app-brand)]">
                  {run.mention}
                </span>
              ),
            )}
          </div>
          <textarea
            ref={input}
            rows={1}
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onScroll={sync}
            onKeyDown={onKeyDown}
            maxLength={maxLength}
            aria-label={placeholder}
            className={`relative field-sizing-content block max-h-40 min-h-9 w-full resize-none border-none bg-transparent text-transparent caret-[var(--color-app-text)] outline-none selection:text-[var(--color-app-text)] ${TEXT}`}
          />
        </div>
        {tools && <div className="mb-0.5 flex flex-none items-center gap-0.5">{tools}</div>}
        {/* Pressing send keeps the focus in the field, so a phone's keyboard
            stays up for the next message. */}
        <button
          type="button"
          aria-label="Send"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onSend}
          disabled={!canSend}
          className={`ml-1 flex size-9 flex-none items-center justify-center rounded-full border-none transition-colors duration-150 ease-out ${
            canSend ? "cursor-pointer bg-brand-500 text-white hover:bg-brand-600" : "cursor-default bg-transparent text-[var(--color-app-text-muted)]"
          }`}
        >
          <SendHorizontal size={18} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      {below && (
        // Only while you're writing: focused, or with a draft. Pressing it
        // keeps the focus in the field, so it doesn't vanish mid-tap.
        <div
          onMouseDown={(e) => e.preventDefault()}
          className={`${value ? "flex" : "hidden group-focus-within/box:flex"} mx-3 mt-1 border-t border-[var(--color-app-border)] pt-2 pb-1.5`}
        >
          {below}
        </div>
      )}
    </div>
  );
}

/** Who and what to tag, floating above the field. `active` is the row
 * Enter picks. */
export function MentionPicker({
  people,
  chapters = [],
  active = 0,
  onPick,
  onChapter,
}: {
  people: { comrade: Comrade; sub: string | null }[];
  chapters?: string[];
  active?: number;
  onPick?: (comrade: Comrade) => void;
  onChapter?: (chapter: string) => void;
}) {
  const label = "px-2 text-ui-xs tracking-eyebrow text-[var(--color-app-text-muted)] uppercase";
  return (
    <div className="flex w-70 max-w-full flex-col gap-0.5 rounded-sm border border-[var(--color-app-border)] bg-[var(--color-app-surface)] p-2 text-[var(--color-app-text)] shadow-md">
      <span className={`${label} py-1`}>Tag a comrade</span>
      {people.map(({ comrade, sub }, i) => (
        <button
          key={comrade.readerId}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick?.(comrade)}
          className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-2 text-left hover:bg-[var(--color-app-chip)] ${i === active ? "bg-[var(--color-app-chip)]" : ""}`}
        >
          <RoomAvatar comrade={comrade} size={28} />
          <span className="text-[12px] font-bold">{personName(comrade.pseudonym)}</span>
          {sub && <span className="text-ui-caption text-[var(--color-app-text-muted)]">{sub}</span>}
        </button>
      ))}
      {chapters.length > 0 && (
        <>
          <span className={`${label} pt-2 pb-1`}>Or a chapter</span>
          <div className="flex flex-wrap gap-1.5 px-1.5 pb-1">
            {chapters.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChapter?.(c)}
                className="min-h-10 cursor-pointer rounded-full border border-[var(--color-app-border)] bg-[var(--reader-bg)] px-3 font-sans text-[13px]/none font-bold"
              >
                {c}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** "Moderator" for one; the room can say more (their chapter). */
const teamSub = (c: MentionCandidate) => (c.role === "moderator" ? TEAM_TAG : null);

/** A room's @ tagging on any field (the room input, the reader's note):
 * the inline mentions hook, the picker floating above the field, and its
 * keys. Put `picker` in a `relative` box around the field; `onKeyDown`
 * returns true when the picker took the key. */
export function useRoomMentions({
  text,
  setText,
  inputRef,
  groupSlug = null,
  chapters = [],
  subFor = teamSub,
  initialTagged,
}: {
  text: string;
  setText: (text: string) => void;
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  groupSlug?: string | null;
  chapters?: string[];
  subFor?: (c: MentionCandidate) => string | null;
  initialTagged?: Tagged[];
}) {
  const [active, setActive] = useState(0);
  const m = useComposerMentions({
    text,
    setText,
    inputRef,
    inline: true,
    groupSlug,
    initialTagged,
  });
  const people = m.pickable.slice(0, 6);
  const q = m.pickerQuery.toLowerCase();
  const chapterHits = chapters.filter((c) => c.toLowerCase().includes(q));
  const at = Math.min(active, Math.max(people.length - 1, 0));

  const onKeyDown = (e: KeyboardEvent): boolean => {
    if (!m.picking) return false;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((at + (e.key === "ArrowDown" ? 1 : people.length - 1)) % Math.max(people.length, 1));
    } else if (e.key === "Enter" && people[at]) {
      e.preventDefault();
      m.pick(people[at]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      m.closePicker();
    }
    return true;
  };

  const picker =
    m.picking && (people.length > 0 || chapterHits.length > 0) ? (
      <div className="absolute bottom-full left-0 z-10 mb-2 w-70 max-w-full">
        <MentionPicker
          people={people.map((c) => ({ comrade: c, sub: subFor(c) }))}
          chapters={chapterHits}
          active={at}
          onPick={(c) => m.pick(people.find((p) => p.readerId === c.readerId)!)}
          onChapter={m.pickText}
        />
      </div>
    ) : null;

  const onChange = (v: string) => {
    setActive(0);
    m.onChange(v);
  };

  return { m, picker, onKeyDown, onChange };
}

/** The input with its picker, for a room. Sending hands over the text and
 * who's tagged; the stream shows the note at once, as sent (useRoomSend). With
 * `canLock` (a book's room, in the reader or on its page), a "Make private" switch inside the box
 * keeps the note private, and a private note tags no one (routeNote). */
export default function RoomInput({
  placeholder,
  groupSlug = null,
  chapters = [],
  subFor = teamSub,
  autoFocus = false,
  canLock = false,
  docked = false,
  onSend,
}: {
  placeholder: string;
  autoFocus?: boolean;
  groupSlug?: string | null;
  chapters?: string[];
  subFor?: (c: MentionCandidate) => string | null;
  canLock?: boolean;
  /** The room's own input, in its footer (RoomField). */
  docked?: boolean;
  onSend: (note: { text: string; mentions: string[]; locked?: boolean }) => void;
}) {
  const [text, setText] = useState("");
  const [locked, setLocked] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { m, picker, onKeyDown, onChange } = useRoomMentions({
    text,
    setText,
    inputRef,
    groupSlug,
    chapters,
    subFor,
  });

  const send = () => {
    const body = text.trim();
    if (!body) return;
    onSend({
      text: body,
      mentions: locked ? [] : m.mentionReaderIds,
      ...(locked && { locked }),
    });
    setText("");
    m.reset();
  };

  const field = (
    <RoomField
      value={text}
      onChange={onChange}
      placeholder={locked ? "A note only you will see" : placeholder}
      mentions={m.kept.map((t) => t.pseudonym)}
      atOpen={m.picking}
      inputRef={inputRef}
      autoFocus={autoFocus}
      docked={docked}
      onAt={locked ? undefined : m.togglePicker}
      onSend={send}
      below={
        canLock && (
          <ShareSwitch
            on={locked}
            onChange={(on) => {
              m.closePicker();
              setLocked(on);
            }}
          />
        )
      }
      onKeyDown={(e) => {
        if (onKeyDown(e)) return;
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && hasKeyboard()) {
          e.preventDefault();
          send();
        }
      }}
    />
  );

  return (
    <div className="relative">
      {picker}
      {field}
    </div>
  );
}

/** "Make private": the label at the start of its own row, the switch at
 * its end — the same row in a composer's box and on your highlight's card.
 * Off by default; on, the note (or highlight) is private. */
export function ShareSwitch({ on, onChange, disabled = false }: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent p-0 text-ui-caption whitespace-nowrap text-[var(--color-app-text-muted)] disabled:cursor-default disabled:opacity-50"
    >
      Make private
      <span className={`relative h-4.5 w-8 flex-none rounded-full transition-colors duration-150 ease-out ${on ? "bg-[var(--color-app-brand)]" : "bg-sand-300"}`}>
        <span
          className={`absolute top-0.5 left-0.5 size-3.5 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out ${on ? "translate-x-3.5" : ""}`}
        />
      </span>
    </button>
  );
}

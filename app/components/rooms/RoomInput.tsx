"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { ArrowUp, AtSign, Calendar, Mic, Plus } from "lucide-react";
import { splitMentions } from "@/lib/community/mentionText";
import type { MentionCandidate } from "@/lib/community/mentionTypes";
import { useComposerMentions, type Tagged } from "@/lib/community/useComposerMentions";
import { personName } from "@/lib/rooms/names";
import { TEAM_TAG } from "@/lib/rooms/timeline";
import type { Comrade } from "@/lib/rooms/types";
import { COMPOSER_TOOL } from "@/app/components/reader/notes/ComposerBox";
import RoomAvatar from "./RoomAvatar";
import RoomPanel from "./RoomPanel";

// A room's input (home-spec §2 Composer, Room.dc.html): the 52 px field
// (rounded-sm) with ＋ (the team only) and @ on the left, the text and a
// square send that turns brand when there's text. Typing @ (or the @ button) floats the picker above the
// field: comrades, then chapters.

const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;
const ROUND = "flex size-9 flex-none cursor-pointer items-center justify-center rounded-sm transition-colors duration-150 ease-out";

/** The field alone, controlled. Tagged "@Name" runs show in brand through a
 * mirror behind the input's transparent text. */
export function RoomField({
  value,
  onChange,
  placeholder,
  mentions = [],
  team = false,
  atOpen = false,
  inputRef,
  onPlus,
  onAt,
  onSend,
  onKeyDown,
  maxLength,
  autoFocus = false,
  canSend = !!value.trim(),
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
  team?: boolean;
  atOpen?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onPlus?: () => void;
  onAt?: () => void;
  onSend?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const mirror = useRef<HTMLDivElement>(null);
  const own = useRef<HTMLInputElement>(null);
  const input = inputRef ?? own;
  const sync = () => {
    if (mirror.current && input.current) mirror.current.scrollLeft = input.current.scrollLeft;
  };
  useLayoutEffect(sync, [value, input]);

  return (
    <div className="flex min-h-13 items-center gap-1 rounded-sm border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-2 py-1.5 text-[var(--color-app-text)] transition-colors duration-150 ease-out focus-within:border-brand-300">
      {team && (
        <button type="button" aria-label="Team actions" onClick={onPlus} className={COMPOSER_TOOL}>
          <Plus size={16} strokeWidth={2} aria-hidden />
        </button>
      )}
      {onAt && (
        <button
          type="button"
          aria-label="Tag a comrade or chapter"
          aria-expanded={atOpen}
          onClick={onAt}
          className={`${COMPOSER_TOOL} ${atOpen ? "!bg-brand-50 !text-[var(--color-app-brand)]" : ""}`}
        >
          <AtSign size={16} strokeWidth={2} aria-hidden />
        </button>
      )}
      <div className="relative min-w-0 flex-1">
        {/* max-md: 16px, as globals.css sets every field there (iOS zoom). */}
        <div aria-hidden ref={mirror} className="pointer-events-none absolute inset-0 truncate px-2 font-sans text-[15px]/9 whitespace-pre max-md:text-[16px]">
          {splitMentions(value, mentions).map((run, i) =>
            typeof run === "string" ? (
              run
            ) : (
              <b key={i} className="text-[var(--color-app-brand)]">
                {run.mention}
              </b>
            ),
          )}
        </div>
        <input
          ref={input}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onScroll={sync}
          onKeyDown={onKeyDown}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label={placeholder}
          className="relative h-9 w-full bg-transparent px-2 font-sans text-[15px]/9 text-transparent caret-[var(--color-app-text)] outline-none placeholder:text-[var(--color-app-text-muted)]"
        />
      </div>
      <button
        type="button"
        aria-label="Send"
        onClick={onSend}
        className={`${ROUND} ${canSend ? "bg-brand-500 text-sand-25 hover:bg-brand-600" : "bg-sand-100 text-[var(--color-app-text-muted)]"}`}
      >
        <ArrowUp size={18} strokeWidth={2.25} aria-hidden />
      </button>
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
    <div className="flex w-70 max-w-full flex-col gap-0.5 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-surface)] p-2 text-[var(--color-app-text)] shadow-md">
      <span className={`${label} py-1`}>Tag a comrade</span>
      {people.map(({ comrade, sub }, i) => (
        <button
          key={comrade.readerId}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick?.(comrade)}
          className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-2 text-left hover:bg-sand-100 ${i === active ? "bg-sand-100" : ""}`}
        >
          <RoomAvatar comrade={comrade} size={28} />
          <span className="text-ui-sm font-bold">{personName(comrade.pseudonym)}</span>
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
  const m = useComposerMentions({ text, setText, inputRef, inline: true, groupSlug, initialTagged });
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
 * who's tagged; the stream shows the note as sending (NoteBubble). */
export default function RoomInput({
  placeholder,
  team = false,
  groupSlug = null,
  chapters = [],
  subFor = teamSub,
  autoFocus = false,
  onPlus,
  onSend,
}: {
  placeholder: string;
  autoFocus?: boolean;
  team?: boolean;
  groupSlug?: string | null;
  chapters?: string[];
  subFor?: (c: MentionCandidate) => string | null;
  onPlus?: () => void;
  onSend: (note: { text: string; mentions: string[] }) => void;
}) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { m, picker, onKeyDown, onChange } = useRoomMentions({ text, setText, inputRef, groupSlug, chapters, subFor });

  const send = () => {
    const body = text.trim();
    if (!body) return;
    onSend({ text: body, mentions: m.mentionReaderIds });
    setText("");
    m.reset();
  };

  return (
    <div className="relative">
      {picker}
      <RoomField
        value={text}
        onChange={onChange}
        placeholder={placeholder}
        mentions={m.kept.map((t) => t.pseudonym)}
        team={team}
        atOpen={m.picking}
        inputRef={inputRef}
        autoFocus={autoFocus}
        onPlus={onPlus}
        onAt={m.togglePicker}
        onSend={send}
        onKeyDown={(e) => {
          if (onKeyDown(e)) return;
          if (e.key === "Enter") {
            e.preventDefault();
            send();
          }
        }}
      />
    </div>
  );
}

const TEAM_ACTIONS = [
  { key: "target", icon: Calendar, title: "Set this week’s target", sub: "Optional. Shows in the pinned bar" },
  { key: "schedule", icon: Calendar, title: "Schedule a reading room", sub: "Posts a session card comrades can set a reminder on" },
  { key: "start", icon: Mic, title: "Start a reading room now", sub: "Goes live for the group straight away" },
] as const;

/** The moderators' ＋ (rooms-spec §2, 5d): what the team can post. */
export function TeamMenu({
  groupName,
  layout = "sheet",
  className,
  onClose,
  onPick,
}: {
  groupName: string;
  layout?: "sheet" | "panel";
  className?: string;
  onClose?: () => void;
  onPick?: (action: (typeof TEAM_ACTIONS)[number]["key"]) => void;
}) {
  return (
    <RoomPanel layout={layout} title="Team actions" sub={groupName} onClose={onClose} className={className}>
      <div className="flex flex-col gap-1 px-3 pt-2 pb-5">
        <span className="px-2 pt-1 pb-2 text-ui-caption text-[var(--color-app-text-secondary)]">
          Everything you post lands in the stream as a card. Comrades don’t see this menu.
        </span>
        {TEAM_ACTIONS.map(({ key, icon: Icon, title, sub }) => (
          <button key={key} type="button" onClick={() => onPick?.(key)} className="flex min-h-15 cursor-pointer items-center gap-3.5 px-2.5 text-left">
            <span className="flex size-10 flex-none items-center justify-center rounded-full border border-[var(--color-app-border)]">
              <Icon {...ICON} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-ui-md font-extrabold">{title}</span>
              <span className="text-ui-caption text-[var(--color-app-text-secondary)]">{sub}</span>
            </span>
          </button>
        ))}
      </div>
    </RoomPanel>
  );
}

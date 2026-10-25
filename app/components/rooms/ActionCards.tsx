"use client";

import type { ReactNode } from "react";
import { Headphones, Pin, PinOff, Target } from "lucide-react";
import { activeRoom, useRoomStore } from "@/stores/room-store";
import PulseDot from "@/app/components/shared/PulseDot";
import { sessionMeta, sessionPeople, targetRange } from "@/lib/rooms/cards";
import { personName } from "@/lib/rooms/names";
import type { RoomItem, RoomSession, RoomTarget } from "@/lib/rooms/types";
import { formatDay } from "@/lib/time/format";
import { button } from "./buttons";
import RoomAvatar from "./RoomAvatar";

// The cards the team posts into a stream (rooms-spec §2, sheet #c4). The
// stream centres them and caps them at 380 px. Moderators (`team`) see Edit
// and Start; comrades never do.

const ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;
const CARD = "flex flex-col gap-2.5 rounded-lg border px-4 pt-3.5 pb-4 transition-shadow duration-250 ease-out";
const FLASH = "ring-3 ring-brand-300";
const EYEBROW = "flex items-center font-sans text-[11px]/[1.3] font-extrabold tracking-eyebrow uppercase";

/** The team's pin on a card: pins it to the room's strip, or unpins it. */
export type CardPin = { pinned: boolean; onToggle: (pin: boolean) => void };

function PinToggle({ pin, className = "" }: { pin: CardPin; className?: string }) {
  const label = pin.pinned ? "Unpin from chat" : "Pin to chat";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pin.pinned}
      onClick={() => pin.onToggle(!pin.pinned)}
      className={`-my-2 -mr-2 flex size-8 flex-none cursor-pointer items-center justify-center rounded-sm hover:bg-[var(--color-app-surface-muted)] ${className}`}
    >
      {pin.pinned ? <PinOff size={14} {...ICON} /> : <Pin size={14} {...ICON} />}
    </button>
  );
}

/** This week's target: how far to read, then your progress and the book's
 * resume buttons (`resume`). The team edits it from the room's ⋮. */
export function TargetCard({ target, flash = false, resume, pin }: { target: RoomTarget; flash?: boolean; resume?: ReactNode; pin?: CardPin }) {
  const { view, bookTitle, setBy } = target;
  const t = view.target!;
  return (
    <div className={`${CARD} ${flash ? FLASH : ""} border-[var(--color-app-border)] bg-[var(--color-app-surface)]`}>
      <div className={`${EYEBROW} gap-1.5 text-[var(--color-app-brand)]`}>
        <Target size={14} {...ICON} />
        <span>This week’s target</span>
        <span className="flex-1" />
        <span className="font-bold tracking-normal text-[var(--color-app-text-muted)] normal-case">Ends {formatDay(t.dueOn, "day")}</span>
        {pin && <PinToggle pin={pin} className="ml-1 text-[var(--color-app-text-muted)]" />}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-serif text-[22px]/[1.2] font-semibold">{targetRange(target)}</span>
        <span className="text-ui-caption text-[var(--color-app-text-secondary)]">
          {bookTitle} · set by {personName(setBy)}
        </span>
      </div>
      {resume}
    </div>
  );
}

/** The live card's level meter: decorative, the played part in brand. */
const WAVE = [10, 18, 12, 24, 16, 28, 14, 22, 9, 20, 26, 12, 18, 24, 10, 16, 22, 14, 8, 18, 12, 6, 10, 6];
const WAVE_PLAYED = 15;

export function SessionCard({
  card,
  team,
  viewerId,
  flash = false,
  onRemind,
  onStart,
  onEdit,
  onJoin,
  pin,
}: {
  card: RoomSession;
  team: boolean;
  viewerId: string | null;
  flash?: boolean;
  onRemind?: () => void;
  onStart?: () => void;
  onEdit?: () => void;
  onJoin?: () => void;
  /** The team's pin, on a scheduled session. */
  pin?: CardPin;
}) {
  const { state, session, people, reading, summary } = card;
  const live = state === "live";
  const ended = state === "ended";
  // One live room per book: you're in this one.
  const joined = useRoomStore((s) => live && activeRoom(s)?.room.materialId === session.materialId);
  const sub = live ? "text-sand-25/68" : "text-[var(--color-app-text-secondary)]";
  return (
    <div className={`${CARD} ${flash ? FLASH : ""} ${live ? "border-sand-900 bg-sand-900 text-sand-25" : "border-[var(--color-app-border)] bg-[var(--color-app-surface)] text-[var(--color-app-text)]"}`}>
      <div className={`${EYEBROW} gap-1.75 ${live ? "text-brand-200" : ended ? "text-[var(--color-app-text-muted)]" : "text-[var(--color-app-brand)]"}`}>
        {live ? <PulseDot tone="live" /> : <Headphones size={14} {...ICON} />}
        <span>{live ? "Live now · Reading room" : ended ? "Reading room · Ended" : "Reading room · Scheduled"}</span>
        {pin && state === "upcoming" && (
          <>
            <span className="flex-1" />
            <PinToggle pin={pin} className="text-[var(--color-app-text-muted)]" />
          </>
        )}
      </div>
      <div className="flex flex-col gap-0.75">
        <span className="font-serif text-[19px]/[1.25] font-semibold text-pretty">{session.topic}</span>
        <span className={`text-ui-caption ${sub}`}>{sessionMeta(card, card.hostId === viewerId)}</span>
      </div>
      {live && (
        <div className="flex h-7 items-center gap-0.75">
          {WAVE.map((h, i) => (
            <span key={i} style={{ height: h }} className={`w-0.75 rounded-[2px] ${i < WAVE_PLAYED ? "bg-brand-300" : "bg-sand-25/25"}`} />
          ))}
          <span className="flex-1" />
          {reading && <span className="text-ui-caption text-sand-25/68">{reading}</span>}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="flex">
          {people.map((c) => (
            <RoomAvatar key={c.readerId} comrade={c} size={24} className={`-mr-1.75 border-2 ${live ? "border-sand-900" : "border-[var(--color-app-surface)]"}`} />
          ))}
        </span>
        <span className={`pl-2 text-ui-caption font-bold ${sub}`}>{sessionPeople(card)}</span>
      </div>
      {ended && summary.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-sm bg-[var(--color-app-surface-muted)] px-3 py-2.5">
          <span className="font-sans text-[11px]/[1.3] font-extrabold tracking-eyebrow text-[var(--color-app-text-muted)] uppercase">Summary</span>
          {summary.map((line) => (
            <span key={line} className="font-serif text-[15px]/[1.5] text-pretty">
              {line}
            </span>
          ))}
        </div>
      )}
      {state === "upcoming" &&
        (team ? (
          <div className="flex gap-2">
            <button type="button" onClick={onStart} className={`flex-1 ${button("primary", { full: true })}`}>
              Start reading room
            </button>
            <button type="button" onClick={onEdit} className={button("ghost")}>
              Edit
            </button>
          </div>
        ) : (
          // Remind me is on unless turned off; someone outside the group has none.
          session.remind !== null && (
            <button type="button" onClick={onRemind} aria-pressed={session.remind} className={`${button("outlineBrand", { full: true })} ${session.remind ? "bg-brand-50" : ""}`}>
              {session.remind ? "Reminder set" : "Remind me"}
            </button>
          )
        ))}
      {live && (
        <button type="button" onClick={onJoin} className={button("primary", { full: true })}>
          {joined ? "Open room" : "Join"}
        </button>
      )}
    </div>
  );
}

/** "The group finished Pedagogy of the Oppressed", between hairlines. */
export function MilestoneCard({ item }: { item: Extract<RoomItem, { t: "milestone" }> }) {
  const { milestone, book } = item;
  return (
    <div className="flex flex-col items-center gap-2 border-y border-[var(--color-app-border)] px-4 py-4.5 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/ominira-mark.png" alt="" className="size-11 object-contain" />
      <span className="font-serif text-[18px] font-semibold">
        {milestone.kind === "book_finished" && book ? (
          <>
            The group finished {book}
          </>
        ) : (
          milestone.title.replace(/\.$/, "")
        )}
      </span>
      {milestone.detail && milestone.kind !== "book_finished" && <span className="text-ui-caption text-[var(--color-app-text-secondary)]">{milestone.detail.replace(/\.$/, "")}</span>}
    </div>
  );
}

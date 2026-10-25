"use client";

import { Fragment, type ReactNode } from "react";
import { Headphones, Pin, Target, X } from "lucide-react";
import PulseDot from "@/app/components/shared/PulseDot";
import { sessionPeople, shortWhen, targetRange } from "@/lib/rooms/cards";
import { formatDay } from "@/lib/time/format";
import type { GroupPin } from "@/lib/groups/types";
import { personName } from "@/lib/rooms/names";
import type { RoomSession, RoomTarget } from "@/lib/rooms/types";

// The rows pinned under a room's header (rooms-spec §2, sheet #c5): what a
// group's moderators pinned (a note, this week's target, a scheduled
// session; ✕ unpins, for them), and a live reading room, always. Tapping a
// row jumps to its card; a live room's row turns dark with Join.

const ICON = { size: 18, strokeWidth: 1.75, "aria-hidden": true, className: "flex-none" } as const;
// In a room (flush) a row is its min-height, as the frames have it; the
// sheet's card form draws its rows content-box, min-height plus padding.
const ROW = "flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left";
const box = (flush: boolean) => (flush ? "" : "box-content");

function Lines({ title, sub, dark = false }: { title: string; sub: string; dark?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-px">
      <span className="text-ui-sm font-bold">{title}</span>
      <span className={`truncate text-ui-caption ${dark ? "text-sand-25/68" : "text-[var(--color-app-text-secondary)]"}`}>{sub}</span>
    </div>
  );
}

/** The dark "Live now" row. */
function Live({ title, sub, onJump, onJoin, className }: { title: string; sub: string; onJump?: () => void; onJoin?: () => void; className: string }) {
  return (
    <div className={`flex min-h-13.5 items-center gap-2.5 bg-sand-900 py-1.5 pr-3 text-sand-25 ${className}`}>
      <button type="button" onClick={onJump} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left">
        <PulseDot tone="onAir" />
        <Lines title={title} sub={sub} dark />
      </button>
      <button type="button" onClick={onJoin} className="h-8 flex-none cursor-pointer rounded-full bg-brand-500 px-3.5 font-sans text-[13px]/8 font-extrabold text-sand-25">
        Join
      </button>
    </div>
  );
}

/** A pinned row: tap it to jump to its card; the moderators' ✕ unpins it. */
function PinRow({ icon, title, sub, onJump, onUnpin, flush }: { icon: ReactNode; title: string; sub: string; onJump?: () => void; onUnpin?: () => void; flush: boolean }) {
  return (
    <div className={`flex items-center ${box(flush)} min-h-12.5 pr-1`}>
      <button type="button" onClick={onJump} className={`${ROW} min-w-0 flex-1`}>
        {icon}
        <Lines title={title} sub={sub} />
      </button>
      {onUnpin && (
        <button type="button" aria-label="Unpin" onClick={onUnpin} className="flex size-9 flex-none cursor-pointer items-center justify-center rounded-sm text-[var(--color-app-text-muted)] hover:bg-[var(--reader-surface-hover)]">
          <X size={18} strokeWidth={1.75} aria-hidden />
        </button>
      )}
    </div>
  );
}

export default function PinnedBar({
  pin,
  onPin,
  onUnpin,
  target,
  onTarget,
  onUnpinTarget,
  session,
  onSession,
  onUnpinSession,
  onJoin,
  flush = false,
}: {
  /** In a room: full width under the header, a hairline below. */
  flush?: boolean;
  /** The pinned note; `onPin` jumps to it. */
  pin?: GroupPin | null;
  onPin?: () => void;
  onUnpin?: () => void;
  /** This week's target, when pinned. */
  target?: RoomTarget | null;
  onTarget?: () => void;
  onUnpinTarget?: () => void;
  /** A live reading room, or a pinned scheduled one. */
  session?: RoomSession | null;
  onSession?: () => void;
  onUnpinSession?: () => void;
  onJoin?: () => void;
}) {
  const rows: ReactNode[] = [];
  if (pin) {
    rows.push(
      <PinRow key="pin" flush={flush} icon={<Pin {...ICON} className="flex-none text-[var(--color-app-brand)]" />} title={`Pinned · ${personName(pin.author)}`} sub={pin.text} onJump={onPin} onUnpin={onUnpin} />,
    );
  }
  if (target?.view.target) {
    rows.push(
      <PinRow
        key="target"
        flush={flush}
        icon={<Target {...ICON} className="flex-none text-[var(--color-app-brand)]" />}
        title={`This week · ${targetRange(target)}`}
        sub={`${target.bookTitle} · ends ${formatDay(target.view.target.dueOn, "day")}`}
        onJump={onTarget}
        onUnpin={onUnpinTarget}
      />,
    );
  }
  if (session?.state === "live") {
    rows.push(<Live key="session" title="Live now" sub={sessionPeople(session)} onJump={onSession} onJoin={onJoin} className={`pl-3 ${box(flush)}`} />);
  } else if (session) {
    rows.push(
      <PinRow
        key="session"
        flush={flush}
        icon={<Headphones {...ICON} className="flex-none text-[var(--color-app-text-secondary)]" />}
        title={shortWhen(session.session.startsAt)}
        sub={`Reading room · ${session.session.topic}`}
        onJump={onSession}
        onUnpin={onUnpinSession}
      />,
    );
  }
  if (rows.length === 0) return null;
  return (
    <div className={`flex flex-none flex-col overflow-hidden border-[var(--color-app-border)] bg-[var(--color-app-surface)] ${flush ? "border-b" : "rounded-md border"}`}>
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 && <div className="h-px bg-[var(--color-app-border)]" />}
          {row}
        </Fragment>
      ))}
    </div>
  );
}

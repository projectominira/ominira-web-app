"use client";

import { Fragment, type ReactNode } from "react";
import { Headphones, Target } from "lucide-react";
import PulseDot from "@/app/components/shared/PulseDot";
import { sessionPeople, shortWhen, targetRange } from "@/lib/rooms/cards";
import type { RoomSession, RoomTarget } from "@/lib/rooms/types";

// The rows pinned under a room's header (rooms-spec §2, sheet #c5): this
// week's target, then the next or live reading room. Tapping a row jumps to
// its card; a live room's row turns dark with Join.

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

export default function PinnedBar({
  target,
  session,
  onTarget,
  onSession,
  onJoin,
  flush = false,
}: {
  /** In a room: full width under the header, a hairline below. */
  flush?: boolean;
  target?: RoomTarget | null;
  session?: RoomSession | null;
  onTarget?: () => void;
  onSession?: () => void;
  onJoin?: () => void;
}) {
  const rows: ReactNode[] = [];
  if (target?.view.target) {
    rows.push(
      <button key="target" type="button" onClick={onTarget} className={`${ROW} ${box(flush)} min-h-12.5`}>
        <Target {...ICON} className="flex-none text-[var(--color-app-brand)]" />
        <Lines title={`This week · ${targetRange(target)}`} sub={`${target.view.onTrack} of ${target.view.memberCount} on track`} />
      </button>,
    );
  }
  if (session?.state === "live") {
    rows.push(<Live key="session" title="Live now" sub={sessionPeople(session)} onJump={onSession} onJoin={onJoin} className={`pl-3 ${box(flush)}`} />);
  } else if (session) {
    rows.push(
      <button key="session" type="button" onClick={onSession} className={`${ROW} ${box(flush)} min-h-12.5`}>
        <Headphones {...ICON} className="flex-none text-[var(--color-app-text-secondary)]" />
        <Lines title={shortWhen(session.session.startsAt)} sub={`Reading room · ${sessionPeople(session)}`} />
      </button>,
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

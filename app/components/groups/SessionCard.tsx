"use client";

import { Bell, BellOff, Mic } from "lucide-react";
import CalendarLeaf from "@/app/components/shared/CalendarLeaf";
import Switch from "@/app/components/shell/Switch";
import { liveLine } from "@/lib/groups/copy";
import { useSessionReminder } from "@/lib/groups/hooks";
import { sessionPhase, startsIn } from "@/lib/groups/sessions";
import type { GroupLiveRoom, GroupRole, GroupSession, SessionsView } from "@/lib/groups/types";
import { useGroupRoom } from "@/lib/groups/useGroupRoom";
import { formatInstant } from "@/lib/time/format";
import { useNow } from "@/lib/time/useNow";
import { primaryButton } from "./buttons";
import { onFail } from "./onFail";

const eyebrow = "text-[11px] font-bold uppercase tracking-[0.08em] text-brand-500";

/** Remind me as a bell and a switch (spec §1 Sessions), on the card. */
function RemindSwitch({ slug, session }: { slug: string; session: GroupSession }) {
  const remind = useSessionReminder(slug);
  const on = session.remind ?? false;
  const Icon = on ? Bell : BellOff;
  return (
    <div className="flex items-center gap-2.5 border-t border-[var(--reader-border)] pt-3">
      <Icon size={16} className={on ? "text-brand-500" : "text-[var(--reader-text-muted)]"} />
      <span className="flex-1 text-[13px] font-semibold text-[var(--reader-text)]">Remind me</span>
      <Switch
        checked={on}
        ariaLabel="Remind me an hour before"
        onChange={(next) => remind.mutate({ session, on: next }, { onError: onFail("Couldn't change the reminder.") })}
      />
    </div>
  );
}

/** The bell on a session row: shows your reminder state, tap to flip it. */
export function RemindBell({ slug, session }: { slug: string; session: GroupSession }) {
  const remind = useSessionReminder(slug);
  if (session.remind === null) return null;
  const on = session.remind;
  const Icon = on ? Bell : BellOff;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Reminder on" : "Reminder off"}
      onClick={() => remind.mutate({ session, on: !on }, { onError: onFail("Couldn't change the reminder.") })}
      className={`flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-sm border-none bg-transparent hover:bg-[var(--reader-surface-hover)] ${
        on ? "text-brand-500" : "text-[var(--reader-text-muted)]"
      }`}
    >
      <Icon size={16} />
    </button>
  );
}

/** The slot's live state (C2): a solid brand bar, "The room is open", "Ama
 * and 9 comrades", with Join for members (Open the room once you're in). */
function LiveCard({ slug, live, isMember }: { slug: string; live: GroupLiveRoom; isMember: boolean }) {
  const room = useGroupRoom(slug);
  return (
    <section aria-label="Live room" className="flex items-center gap-3 rounded-sm bg-brand-500 p-3.5 text-white">
      <span aria-hidden className="h-2 w-2 flex-none rounded-full bg-white" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold">The room is open</span>
        <span className="truncate text-[13px] text-brand-100">{liveLine(live)}</span>
      </span>
      {isMember && (
        <button
          type="button"
          onClick={() => void room.join(live)}
          disabled={room.pending}
          className="inline-flex h-9 flex-none cursor-pointer items-center rounded-sm border-none bg-white px-3.5 text-[13px] font-bold text-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {room.pending ? "Joining…" : room.isIn(live) ? "Open the room" : "Join"}
        </button>
      )}
    </section>
  );
}

/**
 * The session card slot (spec §3.1, M2/C2): the group's live bar when a room
 * is open; for moderators, from an hour before, a compact "Session in 15 min"
 * row with Start room; otherwise the next session as a calendar leaf, with
 * Remind me. With nothing scheduled it shows nothing.
 */
export default function SessionCard({
  slug,
  view,
  role,
  onStartRoom,
}: {
  slug: string;
  view: SessionsView;
  role: GroupRole | null;
  /** Moderators: opens M11. */
  onStartRoom: () => void;
}) {
  const now = useNow(30_000);
  const next = view.upcoming[0];
  if (view.live) return <LiveCard slug={slug} live={view.live} isMember={role !== null} />;

  if (!next) return null;

  const startsAt = Date.parse(next.startsAt);
  const phase = sessionPhase(startsAt, now);
  const lead = phase === "on" ? "on now" : startsIn(startsAt, now);
  const time = formatInstant(next.startsAt, "time");

  if (role === "moderator" && phase !== "upcoming") {
    return (
      <section aria-label="Next session" className="flex items-center gap-3 rounded-sm border border-[var(--reader-border)] p-3.5">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold text-[var(--reader-text)]">Session {lead}</span>
          <span className="truncate text-[13px] text-[var(--reader-text-muted)]">
            {next.topic} · {time}
          </span>
        </span>
        <button type="button" onClick={onStartRoom} className={primaryButton}>
          <Mic size={15} />
          Start room
        </button>
      </section>
    );
  }

  const label = phase === "upcoming" ? "Next session" : phase === "on" ? "On now" : `Starts ${lead}`;
  return (
    <section aria-label="Next session" className="flex flex-col gap-3 rounded-sm border border-[var(--reader-border)] p-3.5">
      <div className="flex items-center gap-3.5">
        <CalendarLeaf instant={next.startsAt} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={eyebrow}>
            {label}
            {next.repeat === "weekly" && " · weekly"}
          </span>
          <span className="font-serif text-base leading-snug font-semibold text-[var(--reader-text)]">{next.topic}</span>
          <span className="text-[13px] text-[var(--reader-text-muted)]">{time} · Reading room</span>
        </span>
      </div>
      {next.remind !== null && phase !== "on" && <RemindSwitch slug={slug} session={next} />}
    </section>
  );
}

"use client";

import { Check } from "lucide-react";
import NoResults from "@/app/components/shared/NoResults";
import type { OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";
import { pct, repeatLabel } from "@/lib/groups/copy";
import { useCancelSession } from "@/lib/groups/hooks";
import { planCheckpoint } from "@/lib/groups/progress";
import type { GroupSession, SessionsView, TargetView } from "@/lib/groups/types";
import { formatDay, formatInstant } from "@/lib/time/format";
import { addDays, daysBetween, deviceTimeZone, localDay } from "@/lib/time/zone";
import { confirmAction } from "@/stores/confirm-store";
import RowMenu from "./RowMenu";
import { RemindBell } from "./SessionCard";
import { onFail } from "./onFail";

const heading = "m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--reader-text-subtle)]";
export const sessionList = "m-0 list-none rounded-md border border-[var(--reader-border)] p-0";

/** One day row (sheet 3.3): the date leaf, that day's checkpoint on the
 * group plan, today tinted. */
function DayRow({
  day,
  checkpoint,
  isToday,
  isDue,
  session,
}: {
  day: string;
  checkpoint: number;
  isToday: boolean;
  isDue: boolean;
  /** "Session at 19:00", in the viewer's clock. */
  session: GroupSession | undefined;
}) {
  const notes = [isToday && "Today", isDue && "target day", session && `Session at ${formatInstant(session.startsAt, "time")}`].filter(
    Boolean
  ) as string[];
  return (
    <li
      className={`flex items-center gap-3.5 border-b border-[var(--reader-border)] px-4 py-3.5 last:border-b-0 first:rounded-t-md last:rounded-b-md ${
        isToday ? "bg-[color-mix(in_srgb,var(--color-brand-500)_8%,transparent)]" : ""
      }`}
    >
      <span className="flex w-10 flex-none flex-col items-center">
        <span className={`text-[11px] font-semibold ${isToday ? "text-brand-500" : "text-[var(--reader-text-muted)]"}`}>
          {formatDay(day, "weekdayShort")}
        </span>
        <span className="font-serif text-xl font-semibold leading-tight text-[var(--reader-text)]">{Number(day.slice(8))}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-[var(--reader-text)]">to {pct(checkpoint)}</span>
        {notes.length > 0 && (
          <span className={`text-xs font-medium ${isToday ? "text-brand-500" : "text-[var(--reader-text-muted)]"}`}>
            {notes.join(" · ").replace(/^./, (c) => c.toUpperCase())}
          </span>
        )}
      </span>
    </li>
  );
}

/** The date leaf (sheet 1.3): weekday over the day of the month. */
function Leaf({ instant, muted }: { instant: string; muted?: boolean }) {
  return (
    <span className="flex w-10 flex-none flex-col items-center">
      <span className="text-[11px] font-semibold text-[var(--reader-text-muted)]">{formatInstant(instant, "weekdayShort")}</span>
      <span
        className={`font-serif text-xl font-semibold leading-tight ${muted ? "text-[var(--reader-text-muted)]" : "text-[var(--reader-text)]"}`}
      >
        {Number(localDay(Date.parse(instant), deviceTimeZone()).slice(8))}
      </span>
    </span>
  );
}

/** One session row (sheet 4.3): upcoming with the bell (and the moderator's
 * menu), or past, with "You came" if you did. */
export function SessionRow({
  slug,
  session,
  past,
  onEdit,
}: {
  slug: string;
  session: GroupSession;
  past?: boolean;
  onEdit?: (session: GroupSession) => void;
}) {
  const cancel = useCancelSession(slug);
  const end = async (scope: "occurrence" | "series") => {
    const weekly = session.repeat === "weekly";
    const ok = await confirmAction({
      title: scope === "series" ? "End the weekly sessions?" : weekly ? "Skip this week's session?" : "Cancel this session?",
      message: scope === "series" ? "This one and every one after it are cancelled." : weekly ? "The series goes on the week after." : undefined,
      confirmLabel: scope === "series" ? "End sessions" : weekly ? "Skip" : "Cancel session",
      danger: true,
    });
    if (ok) cancel.mutate({ id: session.id, scope }, { onError: onFail("Couldn't cancel the session.") });
  };
  const items: OverflowMenuItem[] = onEdit
    ? [
        { label: "Edit", onClick: () => onEdit(session) },
        ...(session.repeat === "weekly"
          ? [
              { label: "Skip this week", onClick: () => end("occurrence") },
              { label: "End weekly sessions", onClick: () => end("series"), danger: true },
            ]
          : [{ label: "Cancel session", onClick: () => end("occurrence"), danger: true }]),
      ]
    : [];

  return (
    <li className="flex items-center gap-3.5 border-b border-[var(--reader-border)] px-4 py-3.5 last:border-b-0">
      <Leaf instant={session.startsAt} muted={past} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`truncate text-[13px] font-semibold ${past ? "text-[var(--reader-text-muted)]" : "text-[var(--reader-text)]"}`}>
          {session.topic}
        </span>
        <span className="text-xs font-medium text-[var(--reader-text-muted)]">
          {formatInstant(session.startsAt, "time")}
          {past ? (
            session.attended && (
              <span className="ml-1 inline-flex items-center gap-1 text-brand-500">
                · <Check size={12} /> You came
              </span>
            )
          ) : (
            ` · ${repeatLabel(session.repeat)}`
          )}
        </span>
      </span>
      {!past && <RemindBell slug={slug} session={session} />}
      {!past && <RowMenu label={`Manage ${session.topic}`} items={items} disabled={cancel.isPending} />}
    </li>
  );
}

/**
 * The Schedule tab (spec §3.1, M3). This week: one row
 * per day from today to the target day, each with the group plan's
 * checkpoint (the same for everyone) and the session on it. Then Sessions:
 * upcoming rows with your bell, then past ones; two to a row on desktop.
 * Setting the target and scheduling live in Manage.
 */
export default function GroupSchedule({
  slug,
  view,
  sessions,
  onEditSession,
}: {
  slug: string;
  view: TargetView | undefined;
  sessions: SessionsView | undefined;
  /** Moderators only: opens M8 on a session. */
  onEditSession?: (session: GroupSession) => void;
}) {
  const target = view?.target;
  const upcoming = sessions?.upcoming ?? [];
  const past = sessions?.past ?? [];
  const sessionOn = (day: string) => upcoming.find((s) => sessions && localDay(Date.parse(s.startsAt), sessions.timezone) === day);

  if (!target && upcoming.length === 0 && past.length === 0) {
    return (
      <div className="mt-4 grid items-start gap-6 shell:grid-cols-2 shell:gap-x-10">
        <NoResults message="No schedule yet." />
      </div>
    );
  }

  const days = view && target ? Array.from({ length: daysBetween(view.today, target.dueOn) + 1 }, (_, i) => addDays(view.today, i)) : [];
  return (
    <div className="mt-4 grid items-start gap-6 shell:grid-cols-2 shell:gap-x-10">
      {view && target && (
        <section className="flex flex-col gap-2">
          <h2 className={heading}>This week</h2>
          <ul className={sessionList}>
            {days.map((day) => (
              <DayRow
                key={day}
                day={day}
                checkpoint={planCheckpoint(target, day)}
                isToday={day === view.today}
                isDue={day === target.dueOn}
                session={sessionOn(day)}
              />
            ))}
          </ul>
        </section>
      )}

      {(upcoming.length > 0 || past.length > 0) && (
        <section className="flex flex-col gap-2">
          <h2 className={heading}>Sessions</h2>
          <ul className={sessionList}>
            {upcoming.map((session) => (
              <SessionRow key={session.id} slug={slug} session={session} onEdit={onEditSession} />
            ))}
            {past.map((session) => (
              <SessionRow key={session.id} slug={slug} session={session} past />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

"use client";

import { Check } from "lucide-react";
import { repeatLabel, sessionWhen } from "@/lib/groups/copy";
import { useCancelSession } from "@/lib/groups/hooks";
import type { GroupSession, SessionsView } from "@/lib/groups/types";
import { confirmAction } from "@/stores/confirm-store";
import ListHeader from "./ListHeader";
import { onFail } from "./onFail";

const control = "min-h-9 cursor-pointer rounded-sm border-none bg-transparent px-2.5 text-[13px] font-bold hover:bg-[var(--reader-surface-hover)]";

/** One session (M8): its topic, when it is, and its controls — Edit and
 * Cancel, or for a weekly one Edit, Skip (this week) and End (the series).
 * A past one is muted, with "You came" if you did. */
function SessionRow({ slug, session, past, onEdit }: { slug: string; session: GroupSession; past?: boolean; onEdit: (session: GroupSession) => void }) {
  const cancel = useCancelSession(slug);
  const weekly = session.repeat === "weekly";
  const end = async (scope: "occurrence" | "series") => {
    const ok = await confirmAction({
      title: scope === "series" ? "End the weekly sessions?" : weekly ? "Skip this week's session?" : "Cancel this session?",
      message: scope === "series" ? "This one and every one after it are cancelled." : weekly ? "The series goes on the week after." : undefined,
      confirmLabel: scope === "series" ? "End sessions" : weekly ? "Skip" : "Cancel session",
      danger: true,
    });
    if (ok) cancel.mutate({ id: session.id, scope }, { onError: onFail("Couldn't cancel the session.") });
  };

  return (
    <li className="flex items-center gap-3 border-b border-[var(--reader-border)] py-3">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`truncate text-[14px] font-semibold ${past ? "text-[var(--reader-text-muted)]" : "text-[var(--reader-text)]"}`}>{session.topic}</span>
        <span className="text-xs font-medium text-[var(--reader-text-muted)]">
          {sessionWhen(session.startsAt)}
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
      {!past && (
        <span className="flex flex-none">
          <button type="button" onClick={() => onEdit(session)} className={`${control} text-[var(--reader-text)]`}>
            Edit
          </button>
          {weekly && (
            <button type="button" onClick={() => void end("occurrence")} disabled={cancel.isPending} className={`${control} text-[var(--reader-text)]`}>
              Skip
            </button>
          )}
          <button type="button" onClick={() => void end(weekly ? "series" : "occurrence")} disabled={cancel.isPending} className={`${control} text-red-600`}>
            {weekly ? "End" : "Cancel"}
          </button>
        </span>
      )}
    </li>
  );
}

/** Manage → Sessions: Schedule session over every session in one list,
 * upcoming then past. */
export default function SessionList({
  slug,
  sessions,
  onEdit,
  onSchedule,
}: {
  slug: string;
  sessions: SessionsView | undefined;
  onEdit: (session: GroupSession) => void;
  onSchedule: () => void;
}) {
  if (!sessions) return null;
  const { upcoming, past } = sessions;
  const count = upcoming.length ? `${upcoming.length} upcoming` : past.length ? "None upcoming" : "No sessions yet";
  return (
    <div className="flex flex-col gap-1 pt-1">
      <ListHeader count={count} label="Schedule session" items={[{ label: "Schedule session", onClick: onSchedule }]} />
      <ul className="m-0 list-none p-0">
        {upcoming.map((session) => (
          <SessionRow key={session.id} slug={slug} session={session} onEdit={onEdit} />
        ))}
        {past.map((session) => (
          <SessionRow key={session.id} slug={slug} session={session} past onEdit={onEdit} />
        ))}
      </ul>
    </div>
  );
}

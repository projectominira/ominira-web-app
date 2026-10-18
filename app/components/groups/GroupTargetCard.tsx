"use client";

import { pct, targetTitle } from "@/lib/groups/copy";
import { useChapterEnds } from "@/lib/groups/hooks";
import { personalCheckpoint, targetFraction } from "@/lib/groups/progress";
import type { GroupRole, TargetView } from "@/lib/groups/types";
import { primaryButton } from "./buttons";

const eyebrow = "text-[11px] font-bold uppercase tracking-[0.08em] text-brand-500";
const card = "flex flex-col gap-2.5 rounded-md border border-[var(--reader-border)] bg-[var(--reader-surface)] p-4";
const link = "cursor-pointer border-none bg-transparent p-0 text-[13px] font-semibold text-brand-500";

function Bar({ fraction }: { fraction: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--reader-border)]">
      <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round(fraction * 100)}%` }} />
    </div>
  );
}

/**
 * The weekly target card (spec §3.1, sheet 3.1). A member sees their own
 * stretch ("You · 34% of 52% · today to 41%"); a moderator sees the group's
 * pace with Edit and See who; anyone else sees the group line. With no
 * target running it shows nothing, or, given `onSet` (Manage → Reading
 * list), an empty card with Set target.
 */
export default function GroupTargetCard({
  view,
  role,
  onEdit,
  onSeeWho,
  onSet,
}: {
  view: TargetView;
  role: GroupRole | null;
  onEdit: () => void;
  onSeeWho: () => void;
  /** Manage only: shows the empty card, opening M7. */
  onSet?: () => void;
}) {
  const { target, today, onTrack, memberCount, mine } = view;
  const isModerator = role === "moderator";
  // Moderators: fetch the outline now, so Edit / Set target opens with it.
  useChapterEnds(isModerator ? view.currentMaterialId : null);

  if (!target) {
    if (!onSet || !view.currentMaterialId) return null;
    return (
      <section aria-label="This week's target" className={card}>
        <span className={eyebrow}>This week</span>
        <span className="font-serif text-xl font-semibold leading-tight text-[var(--reader-text)]">No target yet</span>
        <span className="text-[13px] font-medium text-[var(--reader-text-muted)]">
          Pick a chapter and a day. The daily share is worked out for everyone.
        </span>
        <button type="button" onClick={onSet} className={`${primaryButton} mt-1 h-10 self-start`}>
          Set target
        </button>
      </section>
    );
  }

  const onTrackLine = `${onTrack} of ${memberCount} on track`;
  const myPct = mine?.pct ?? 0;
  const checkpoint = mine ? personalCheckpoint(target, myPct, today) : null;

  return (
    <section aria-label="This week's target" className={card}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={eyebrow}>This week</span>
        {isModerator ? (
          <button type="button" onClick={onEdit} className={link}>
            Edit
          </button>
        ) : (
          <span className="text-[13px] font-medium text-[var(--reader-text-muted)]">{onTrackLine}</span>
        )}
      </div>
      <span className="font-serif text-xl font-semibold leading-tight text-[var(--reader-text)]">{targetTitle(target, today)}</span>

      {isModerator ? (
        <>
          <Bar fraction={memberCount ? onTrack / memberCount : 0} />
          <div className="flex justify-between text-[13px] font-medium text-[var(--reader-text-muted)]">
            <span>{onTrackLine}</span>
            <button type="button" onClick={onSeeWho} className={link}>
              See who
            </button>
          </div>
        </>
      ) : (
        mine && (
          <>
            <Bar fraction={targetFraction(target, myPct)} />
            <span className="text-[13px] font-medium text-[var(--reader-text-muted)]">
              {checkpoint === null
                ? "You · Done for this week"
                : `You · ${mine.pct === null ? "not started" : pct(myPct)} of ${pct(target.endPct)} · today to ${pct(checkpoint)}`}
            </span>
          </>
        )
      )}
    </section>
  );
}

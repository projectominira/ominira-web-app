"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { FOOT, Footer, StepButton } from "@/app/components/home/TodayCard";
import RoomPanel from "@/app/components/rooms/RoomPanel";
import { errorMessage } from "@/lib/api/client";
import { pct } from "@/lib/groups/copy";
import { useClearTarget, useSetTarget } from "@/lib/groups/hooks";
import { targetDueOn } from "@/lib/groups/progress";
import type { TargetView } from "@/lib/groups/types";
import { formatDay } from "@/lib/time/format";
import { showToast } from "@/stores/toast-store";

/** What − and ＋ move the target by, in points. */
const STEP = 5;

/**
 * This week's target (rooms-spec 5b, M7's logic): one slider for how far to
 * read, as a percentage of the book (as every reader's progress is), due at
 * the end of the week. Opens on the running target, so it doubles as Edit; "No target
 * this week" ends it. Members always hear about a new one (`target_set`).
 */
export function TargetPanel({
  layout,
  slug,
  view,
  bookTitle,
  groupName,
  className,
  onClose,
}: {
  layout: "sheet" | "panel";
  slug: string;
  view: TargetView;
  bookTitle: string;
  groupName?: string;
  className?: string;
  onClose: () => void;
}) {
  const { today, target, draftStartPct: startPct } = view;
  const set = useSetTarget(slug);
  const clear = useClearTarget(slug);

  const min = 1;
  const done = startPct >= 100;
  // Until it's moved: the running target, else ~10% on from where the group is.
  const [moved, setMoved] = useState<number | null>(null);
  const endPct = moved ?? target?.endPct ?? Math.min(100, Math.ceil((startPct + 10) / STEP) * STEP);
  const reading = pct(endPct);
  const dueOn = targetDueOn(today, target);
  const busy = set.isPending || clear.isPending;
  const valid = !done && endPct >= min;

  // A step: to the next multiple of STEP either way.
  const step = (dir: 1 | -1) => {
    const to = dir > 0 ? Math.floor(endPct / STEP) * STEP + STEP : Math.ceil(endPct / STEP) * STEP - STEP;
    setMoved(Math.max(min, Math.min(100, to)));
  };

  const submit = () => {
    if (busy || !valid) return;
    set.mutate(
      { endPct, endLabel: reading, endChapter: null, chapterCount: null, dueOn, notify: true },
      {
        onSuccess: () => {
          showToast("Target set");
          onClose();
        },
      }
    );
  };
  const none = () => {
    if (!target) return onClose();
    if (!busy) clear.mutate(undefined, { onSuccess: onClose });
  };
  const failed = set.error ?? clear.error;

  return (
    <RoomPanel layout={layout} title="This week’s target" sub={groupName} onClose={onClose} className={className}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto text-[var(--color-app-text)]">
        <div className="flex flex-col gap-4 px-5 pt-4 pb-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ui-xs tracking-eyebrow text-[var(--color-app-text-muted)] uppercase">Weekly target</span>
            <span className="text-ui-xs text-[var(--color-app-text-secondary)]">Due {formatDay(dueOn, "day")}</span>
          </div>
          <span className="truncate font-serif text-[14px] font-semibold">{bookTitle}</span>
          {done ? (
            <span className="text-ui-sm font-bold">The group has reached the end of this book.</span>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <StepButton label="Read less" disabled={endPct <= min} onClick={() => step(-1)}>
                  <Minus size={18} strokeWidth={2} aria-hidden />
                </StepButton>
                <div className="flex min-w-0 flex-col items-center gap-1.5 text-center" aria-live="polite">
                  <span className="font-serif text-[22px]/[1.15] font-semibold tabular-nums">{reading}</span>
                </div>
                <StepButton label="Read more" disabled={endPct >= 100} onClick={() => step(1)}>
                  <Plus size={18} strokeWidth={2} aria-hidden />
                </StepButton>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={min}
                  max={100}
                  step={1}
                  value={endPct}
                  onChange={(e) => setMoved(Number(e.target.value))}
                  aria-label="Read up to"
                  aria-valuetext={reading}
                  className="h-6 w-full cursor-pointer accent-brand-500"
                />
              </div>
            </>
          )}
          {failed && <span className="text-ui-xs font-bold text-oxblood-600">{errorMessage(failed) ?? "Couldn’t save the target. Try again."}</span>}
        </div>
        <Footer>
          <button type="button" onClick={none} disabled={busy} className={FOOT}>
            {target ? "No target" : "Cancel"}
          </button>
          <button type="button" onClick={submit} disabled={busy || !valid} className={`${FOOT} font-bold text-[var(--color-app-brand)] disabled:opacity-40`}>
            {set.isPending ? "Setting…" : "Set target"}
          </button>
        </Footer>
      </div>
    </RoomPanel>
  );
}

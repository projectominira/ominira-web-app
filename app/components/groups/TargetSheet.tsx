"use client";

import { useState } from "react";
import { button } from "@/app/components/rooms/buttons";
import RoomPanel from "@/app/components/rooms/RoomPanel";
import BottomSheet from "@/app/components/shared/BottomSheet";
import { errorMessage } from "@/lib/api/client";
import { chapterLabel, pct } from "@/lib/groups/copy";
import { useChapterEnds, useClearTarget, useSetTarget } from "@/lib/groups/hooks";
import { targetDueOn } from "@/lib/groups/progress";
import type { TargetView } from "@/lib/groups/types";
import { chapterAt, rangeLabel } from "@/lib/rooms/cards";
import { formatDay } from "@/lib/time/format";
import { showToast } from "@/stores/toast-store";

/** The percentage chips, for a book without chapters. */
const PERCENTS = [25, 50, 75, 100];
const MODES = [
  { key: "ch", label: "By chapter" },
  { key: "pct", label: "By percent" },
] as const;

const CHIP = "min-h-11 min-w-16 cursor-pointer rounded-full border px-3.5 font-sans text-[14px]/none font-bold";

/**
 * This week's target (rooms-spec 5b, M7's logic): read up to a chapter end
 * from the book's outline, or a percentage, by the end of the week. Opens
 * on the running target, so it doubles as Edit; "No target this week" ends
 * it. Members always hear about a new one (`target_set`).
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
  const { today, target, draftStartPct: startPct, currentMaterialId } = view;
  const { data: ends = [], isLoading } = useChapterEnds(currentMaterialId);
  const set = useSetTarget(slug);
  const clear = useClearTarget(slug);

  const chapters = ends.map((end, i) => ({ ...end, index: i + 1 })).filter((end) => end.endPct > startPct);
  const percents = PERCENTS.filter((p) => p > startPct);
  const [mode, setMode] = useState<"ch" | "pct" | null>(null);
  const byChapter = (mode ?? (target && target.endChapter === null ? "pct" : "ch")) === "ch" && chapters.length > 0;
  const [picked, setPicked] = useState<number | null>(target?.endChapter ?? null);
  const [pickedPct, setPickedPct] = useState<number | null>(target && target.endChapter === null ? target.endPct : null);

  const chapter = byChapter ? (chapters.find((c) => c.index === picked) ?? chapters[0]) : null;
  const endPct = chapter ? chapter.endPct : (pickedPct ?? percents[Math.min(1, percents.length - 1)]);
  const endLabel = chapter ? chapterLabel(chapter.label) : pct(endPct);
  const dueOn = targetDueOn(today, target);
  const title = rangeLabel(endLabel, !!chapter, chapterAt(ends, startPct));
  const busy = set.isPending || clear.isPending;

  const submit = () => {
    if (busy || !(endPct > startPct)) return;
    set.mutate(
      { endPct, endLabel, endChapter: chapter?.index ?? null, chapterCount: chapter ? ends.length : null, dueOn, notify: true },
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
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pt-4 pb-5 text-[var(--color-app-text)]">
        <div className="flex flex-col gap-1">
          <span className="text-ui-md font-extrabold">Read up to</span>
          <span className="text-ui-caption text-[var(--color-app-text-secondary)]">
            {bookTitle} · by {formatDay(dueOn, "day")}
          </span>
        </div>
        {chapters.length > 0 && (
          <div role="radiogroup" aria-label="Measure by" className="flex rounded-full bg-sand-100 p-0.75">
            {MODES.map(({ key, label }) => {
              const on = (key === "ch") === byChapter;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMode(key)}
                  className={`min-h-10 flex-1 cursor-pointer rounded-full font-sans text-[13px]/none font-bold ${on ? "bg-[var(--color-app-surface)] shadow-sm" : ""}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
        <div role="radiogroup" aria-label="Target" className="flex flex-wrap gap-2">
          {isLoading ? (
            <span className="text-ui-caption text-[var(--color-app-text-muted)]">Loading chapters…</span>
          ) : (
            (byChapter ? chapters.map((c) => ({ key: c.index, label: chapterLabel(c.label), on: c === chapter, pick: () => setPicked(c.index) })) : percents.map((p) => ({ key: p, label: pct(p), on: p === endPct, pick: () => setPickedPct(p) }))).map(
              ({ key, label, on, pick }) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={pick}
                  className={`${CHIP} ${on ? "border-sand-950 bg-sand-950 text-sand-25" : "border-[var(--color-app-border)]"}`}
                >
                  {label}
                </button>
              )
            )
          )}
        </div>
        <span className="text-ui-caption text-pretty text-[var(--color-app-text-secondary)]">
          Books without chapters use percent. Comrades see <b className="text-[var(--color-app-text)]">This week · {title}</b> in the pinned bar.
        </span>
        {failed && <span className="text-ui-caption font-bold text-oxblood-600">{errorMessage(failed) ?? "Couldn’t save the target. Try again."}</span>}
        <div className="flex flex-col gap-2">
          <button type="button" onClick={submit} disabled={busy || !(endPct > startPct)} className={button("primary", { full: true })}>
            {set.isPending ? "Setting…" : "Set target"}
          </button>
          <button type="button" onClick={none} disabled={busy} className={button("ghost", { full: true })}>
            No target this week
          </button>
        </div>
      </div>
    </RoomPanel>
  );
}

/** The same, as a sheet of its own: the group's manage pages open it. */
export default function TargetSheet(props: { slug: string; view: TargetView; bookTitle: string; onClose: () => void }) {
  return (
    <BottomSheet bare onClose={props.onClose}>
      <TargetPanel layout="sheet" {...props} />
    </BottomSheet>
  );
}

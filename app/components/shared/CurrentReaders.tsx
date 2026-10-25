"use client";

import PulseDot from "./PulseDot";
import type { CurrentReaderSummary } from "@/lib/api/types";

type Props = { readers: CurrentReaderSummary[]; totalCount: number };

/**
 * "Who's reading this right now" on a book list row: a compact signal with
 * no per-person chrome (the row has no room for more). Data is
 * lib/reader/activity.ts's listCurrentReaders. A book's own room shows its
 * readers by name and chapter (rooms-spec §2, ReadingChips).
 */
export function PresenceLine({ readers, totalCount }: Props) {
  if (readers.length === 0) return null;

  return (
    <div className="mt-0.5 flex items-center gap-1.5">
      <PulseDot />
      <span className="text-[11px] font-medium text-[var(--reader-text-muted)]">
        {totalCount} currently reading
      </span>
    </div>
  );
}

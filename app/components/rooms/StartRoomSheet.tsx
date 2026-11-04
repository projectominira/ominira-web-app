"use client";

import { useState } from "react";
import SheetActions from "@/app/components/groups/SheetActions";
import BookResultRow, { BookResultSkeleton } from "@/app/components/shared/BookResultRow";
import NoResults from "@/app/components/shared/NoResults";
import { useContinueReading } from "@/lib/auth/useContinueReading";
import { useSavedMaterials } from "@/lib/bookmarks/useBookmarks";
import type { MaterialSummary } from "@/lib/api/types";
import { useMaterialsSearch } from "@/lib/materials/useMaterialsSearch";
import BookSearchModal from "./BookSearchModal";

const HEADING = "m-0 pt-1 text-[11px] font-extrabold tracking-eyebrow text-[var(--reader-text-muted)]";

/** Public books only: a room is public. */
const isPublic = (m: MaterialSummary) => m.visibility === "public";

/**
 * "Start a reading room": search the library for the book, in the library
 * search's own rows (BookResultRow). Before you type, your shelf (reading,
 * then saved, then finished: the Shelf's own queries, likely cached). Tap
 * a book to select it, then Start room (the study group sheet's footer).
 */
export default function StartRoomSheet({ onPick, onClose }: { onPick: (book: MaterialSummary) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<MaterialSummary | null>(null);
  const { results, isSearching } = useMaterialsSearch(query, { limit: 20 });
  const { data: activities, isPending: readingPending } = useContinueReading();
  const { data: saved, isPending: savedPending } = useSavedMaterials();
  const found = results.filter(isPublic);
  const reading = (activities ?? []).filter((a) => !a.finishedAt).map((a) => a.material);
  const finished = (activities ?? []).filter((a) => a.finishedAt).map((a) => a.material);
  const shelf = [...new Map([...reading, ...(saved ?? []), ...finished].filter(isPublic).map((m) => [m.id, m])).values()];
  const row = (m: MaterialSummary) => (
    <BookResultRow key={m.id} material={m} query={query} selected={picked?.id === m.id} onSelect={() => setPicked(picked?.id === m.id ? null : m)} />
  );
  const skeletons = (n: number) => Array.from({ length: n }).map((_, i) => <BookResultSkeleton key={i} />);

  return (
    <BookSearchModal
      label="Start a reading room"
      placeholder="Search for a book to read together"
      query={query}
      onQuery={setQuery}
      onClose={onClose}
      idle={
        readingPending || savedPending
          ? skeletons(3)
          : shelf.length > 0 && (
              <section>
                <h3 className={HEADING}>FROM YOUR SHELF</h3>
                {shelf.map(row)}
              </section>
            )
      }
      footer={<SheetActions label="Start room" onCancel={onClose} onConfirm={() => picked && onPick(picked)} disabled={!picked} />}
    >
      {isSearching ? skeletons(5) : found.map(row)}
      {!isSearching && found.length === 0 && <NoResults className="py-10 text-center" message={`No books for "${query}"`} />}
    </BookSearchModal>
  );
}

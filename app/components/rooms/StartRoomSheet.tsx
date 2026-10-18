"use client";

import { useState } from "react";
import BookListRow from "@/app/components/shell/BookListRow";
import NoResults from "@/app/components/shared/NoResults";
import { useMaterialsSearch } from "@/lib/materials/useMaterialsSearch";
import { useRoomSuggestions } from "@/lib/rooms/useHome";
import type { StartableBook } from "@/lib/rooms/types";
import BookSearchModal, { BookSkeleton as Skeleton } from "./BookSearchModal";

const HEADING = "m-0 pt-1 text-[11px] font-extrabold tracking-eyebrow text-[var(--reader-text-muted)]";

/** "2 comrades read this today", when anyone did. */
const readToday = (n: number) => (n > 0 ? `${n} comrade${n === 1 ? "" : "s"} read this today` : undefined);

/**
 * "Start a room": pick the book to read together, in BookSearchModal. Before
 * you type, every book you're currently reading and every one comrades read
 * today (they're invited when it starts), loaded as it opens. Rows are the
 * Shelf's (BookListRow), progress bar and all. Public books only: a room is
 * public.
 */
export default function StartRoomSheet({ onPick, onClose }: { onPick: (book: StartableBook) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const { results, isSearching } = useMaterialsSearch(query, { limit: 20 });
  const { data: books, isPending } = useRoomSuggestions();
  const found = results.filter((m) => m.visibility === "public");
  // Search can't say who read a book today; the suggestions can.
  const readers = new Map([...(books?.mine ?? []), ...(books?.today ?? [])].map((b) => [b.material.id, b.readers]));
  const row = (b: StartableBook) => <BookListRow key={b.material.id} material={b.material} note={readToday(b.readers)} onPick={() => onPick(b)} />;

  return (
    <BookSearchModal
      label="Start a reading room"
      placeholder="Search the library for a book"
      query={query}
      onQuery={setQuery}
      onClose={onClose}
      idle={
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 font-serif text-base font-semibold text-[var(--reader-text)]">Start a reading room</h2>
            <p className="m-0 text-[13px] leading-relaxed text-[var(--reader-text-muted)]">Pick a book, or search for one. Anyone reading it can join and listen in.</p>
          </div>
          {isPending && (
            <section>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} />
              ))}
            </section>
          )}
          {!!books?.mine.length && (
            <section>
              <h3 className={HEADING}>CURRENTLY READING</h3>
              {books.mine.map(row)}
            </section>
          )}
          {!!books?.today.length && (
            <section>
              <h3 className={HEADING}>BEING READ TODAY</h3>
              {books.today.map(row)}
            </section>
          )}
        </div>
      }
    >
      {isSearching ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} />) : found.map((m) => row({ material: m, readers: readers.get(m.id) ?? 0 }))}
      {!isSearching && found.length === 0 && <NoResults className="py-10 text-center" message={`No books for "${query}"`} />}
    </BookSearchModal>
  );
}

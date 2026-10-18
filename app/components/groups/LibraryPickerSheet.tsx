"use client";

import { useState } from "react";
import BookSearchModal, { BookSkeleton } from "@/app/components/rooms/BookSearchModal";
import BookListRow from "@/app/components/shell/BookListRow";
import NoResults from "@/app/components/shared/NoResults";
import { useMaterialsSearch } from "@/lib/materials/useMaterialsSearch";

/** From library (M9): Start a room's modal and rows, web pages included,
 * public only. Stays open so several books can be added in a row; a row
 * tells Adding… then Added. */
export default function LibraryPickerSheet({
  onPick,
  onClose,
  listed,
}: {
  /** Resolves once the book is on the list, rejects if the add failed. */
  onPick: (materialId: string) => Promise<unknown>;
  onClose: () => void;
  /** Material ids already on the list. */
  listed: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const { results, isSearching } = useMaterialsSearch(query, { limit: 20, includeWebpages: true });
  const books = results.filter((m) => m.visibility === "public");

  const pick = (id: string) => {
    if (listed.has(id) || adding.has(id)) return;
    setAdding((s) => new Set(s).add(id));
    onPick(id)
      .catch(() => {})
      .finally(() =>
        setAdding((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        })
      );
  };

  return (
    <BookSearchModal
      label="Add to the reading list"
      placeholder="Search the library for a book"
      query={query}
      onQuery={setQuery}
      onClose={onClose}
      idle={
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-serif text-base font-semibold text-[var(--reader-text)]">Add to the reading list</h2>
          <p className="m-0 text-[13px] leading-relaxed text-[var(--reader-text-muted)]">Search the library, then pick a book to add it. You can add several.</p>
        </div>
      }
    >
      {isSearching
        ? Array.from({ length: 5 }).map((_, i) => <BookSkeleton key={i} />)
        : books.map((m) => (
            <BookListRow key={m.id} material={m} note={listed.has(m.id) ? "Added" : adding.has(m.id) ? "Adding…" : "Add to the list"} onPick={() => pick(m.id)} />
          ))}
      {!isSearching && books.length === 0 && <NoResults className="py-10 text-center" message={`No public results for "${query}"`} />}
    </BookSearchModal>
  );
}

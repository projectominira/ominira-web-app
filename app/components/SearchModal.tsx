"use client";

import { useEffect, useMemo, useState } from "react";
import NoResults from "@/app/components/shared/NoResults";
import { Search, X } from "lucide-react";
import type { BookDocument } from "@/lib/book/schema";
import { useMaterialsSearch } from "@/lib/materials/useMaterialsSearch";
import { buildBookIndex, searchBook, type SearchResult } from "@/lib/search/bookIndex";
import BookResultRow, { BookResultSkeleton, highlight } from "@/app/components/shared/BookResultRow";
import RequestFromSearch from "@/app/components/shared/RequestFromSearch";

type Props = {
  /** Omitted on the home page, which has no single book in scope — see the
   * library-wide branch below. Every in-reader call site (Reader.tsx) still
   * passes this, keeping that book-scoped passage search unchanged. */
  book?: BookDocument;
  onNavigate?: (sectionId: string, passageId: string) => void;
  onClose?: () => void;
};

export default function SearchModal({ book, onNavigate, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Book-scoped passage search (in-reader only) vs. library-wide book
  // search (home page + library page) — mutually exclusive, gated on
  // whether a `book` was actually passed in. buildBookIndex/searchBook
  // below are no-ops (never called) whenever `book` is undefined. Neither
  // branch splits into tabs (chapter/notes/discourse) any more — one
  // unified, relevance-ordered result list either way: MiniSearch's own
  // `.search()` already returns book results ranked highest-scoring first
  // (searchBook does no re-sorting of its own), and the library-wide branch
  // is ranked server-side (lib/materials/list.ts's relevanceScore).
  const index = useMemo(() => (book ? buildBookIndex(book) : null), [book]);
  const results: SearchResult[] = useMemo(() => (index ? searchBook(index, query) : []), [index, query]);
  const { results: libraryResults, isSearching } = useMaterialsSearch(book ? "" : query, { limit: 20 });

  return (
    <div
      className={`w-full h-full box-border bg-black/45 flex justify-center ${
        isMobile ? "items-stretch p-0" : "items-start py-16 px-6"
      }`}
    >
      <div
        className={`w-full bg-[var(--reader-surface)] shadow-lg flex flex-col box-border overflow-hidden ${
          isMobile ? "h-full rounded-none" : "max-w-[640px] h-[640px] rounded-lg"
        }`}
      >
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[var(--reader-border)] flex-none">
          <Search size={18} className="text-[var(--reader-text-muted)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={book ? "Search document..." : "Search the library"}
            className="flex-1 border-none outline-none text-[13px] font-semibold text-[var(--reader-text)] bg-transparent"
          />
          {query && (
            <span
              onClick={() => setQuery("")}
              className="cursor-pointer text-[var(--reader-text-muted)]"
            >
              <X size={16} />
            </span>
          )}
          <span
            onClick={onClose}
            className="cursor-pointer text-sm font-semibold text-[var(--reader-text-muted)] whitespace-nowrap"
          >
            {isMobile ? "Cancel" : "Close"}
          </span>
        </div>

        <div className="om-scroll flex-1 overflow-y-auto px-5 py-4">
          {book ? (
            <>
              {results.map((r) => (
                <div
                  key={r.passageId}
                  // Navigates without closing the modal — a reader jumping
                  // between several passages shouldn't have to reopen
                  // search after every click; Close/Cancel (or the X) is
                  // still right there for when they're actually done.
                  onClick={() => onNavigate?.(r.sectionId, r.passageId)}
                  className="py-3 border-b border-[var(--reader-border)] cursor-pointer"
                >
                  {/* Stacked on mobile (each of title/author/section gets
                      its own line — there's rarely room for all three side
                      by side on a phone-width modal), but from md up they
                      sit inline and wrap only if they actually don't fit —
                      not a fixed vertical stack regardless of width. */}
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-serif text-[13px] font-semibold text-[var(--reader-text)]">
                      {book.metadata.title}
                    </span>
                    <span className="text-xs text-[var(--reader-text-muted)]">{book.metadata.author}</span>
                    <span className="text-xs font-medium text-[var(--reader-text-muted)]">
                      {r.sectionTitle}
                    </span>
                  </div>
                  <p className="mt-1.5 font-serif type-4 text-[14px] text-[var(--reader-text)]">
                    {highlight(r.text, query)}
                  </p>
                </div>
              ))}
              {query.trim() && results.length === 0 && (
                <NoResults className="text-center py-10" message={`No results for "${query}".`} />
              )}
            </>
          ) : (
            <>
              {isSearching
                ? Array.from({ length: 5 }).map((_, i) => <BookResultSkeleton key={i} />)
                : libraryResults.map((material) => (
                    // Left open on click, same as the book-scoped branch
                    // above: browsing several results shouldn't lose the search.
                    <BookResultRow key={material.id} material={material} query={query} href={`/library/${material.slug}`} />
                  ))}
              {!isSearching && query.trim() && libraryResults.length === 0 && (
                <div className="py-10 text-center">
                  <NoResults className="m-0" message={`No results for "${query}"`} />
                  <RequestFromSearch key={query.trim().toLowerCase()} query={query} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

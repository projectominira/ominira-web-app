"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import BookCover from "@/app/components/shared/BookCover";
import type { MaterialSummary } from "@/lib/api/types";
import { resolveBookCoverSrc } from "@/lib/materials/image";
import { useShell } from "@/app/components/useShell";
import { SECTION_TITLE } from "./StudyGroups";

const ARROW =
  "flex size-9 flex-none cursor-pointer items-center justify-center rounded-full border border-[var(--reader-border)] bg-[var(--reader-bg)] p-0 text-[var(--reader-text)] transition-[opacity,background-color] hover:bg-[var(--reader-surface-hover)] disabled:cursor-default disabled:opacity-40";

/**
 * For you: a shelf of books picked for the reader (lib/recommend/books) —
 * cover, title, author and how many are reading it now — each opening its
 * book page. Swiped on mobile, bleeding to the screen's edge; on desktop,
 * arrows that dim at each end. None, nothing: Home hides it for readers too
 * new for good picks. Also a book page's "Related books" (BookExtras), with
 * its own title.
 */
export default function ForYou({
  books,
  desktop: given,
  title = "For you",
  titleClassName = SECTION_TITLE,
}: {
  books: MaterialSummary[];
  /** The shell breakpoint, when not given. */
  desktop?: boolean;
  title?: string;
  titleClassName?: string;
}) {
  const shell = useShell();
  const desktop = given ?? shell;
  const shelf = useRef<HTMLDivElement>(null);
  const [ends, setEnds] = useState({ start: true, end: false });
  const measure = useCallback(() => {
    const el = shelf.current;
    if (el) setEnds({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    if (!desktop) return;
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [desktop, measure, books]);

  if (books.length === 0) return null;
  const scroll = (dir: 1 | -1) => {
    const el = shelf.current;
    if (el) el.scrollBy({ left: dir * (el.clientWidth - 80), behavior: "smooth" });
  };
  const showArrows = desktop && !(ends.start && ends.end);
  return (
    <section className="flex min-w-0 flex-col gap-3.5">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <h2 className={titleClassName}>{title}</h2>
        {showArrows && (
          <div className="flex flex-none gap-2">
            <button type="button" aria-label="Previous" onClick={() => scroll(-1)} disabled={ends.start} className={ARROW}>
              <ChevronLeft size={18} strokeWidth={2} />
            </button>
            <button type="button" aria-label="Next" onClick={() => scroll(1)} disabled={ends.end} className={ARROW}>
              <ChevronRight size={18} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
      <div
        ref={shelf}
        onScroll={desktop ? measure : undefined}
        className={`flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [scrollbar-width:none] ${desktop ? "" : "-mx-4 scroll-px-4 px-4"}`}
      >
        {books.map((m) => (
          <Link
            key={m.id}
            href={`/library/${m.slug}`}
            className={`flex flex-none snap-start flex-col gap-2 text-[var(--reader-text)] no-underline transition-opacity hover:opacity-88 ${desktop ? "w-32" : "w-[132px]"}`}
          >
            <BookCover materialType={m.materialType} src={resolveBookCoverSrc(m)} alt="" className="aspect-2/3 w-full rounded-xs ring-1 ring-sand-950/8" />
            <span className="flex flex-col gap-0.5">
              <span className="line-clamp-2 font-serif text-[15px]/[1.3] font-semibold">{m.title}</span>
              {m.author && <span className="truncate text-ui-caption text-[var(--color-app-text-secondary)]">{m.author}</span>}
            </span>
            {m.currentReaderCount > 0 && <span className="text-ui-caption text-[var(--color-app-text-muted)]">{m.currentReaderCount} currently reading</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}

"use client";

import { Share } from "lucide-react";
import ReaderLink from "@/app/components/ReaderLink";
import BookCover from "@/app/components/shared/BookCover";
import type { HomePassage } from "@/lib/rooms/types";
import { useShareQuote } from "@/app/components/reader/ShareQuoteModal";

/** The quote's size by its length: a short line large, a long one smaller. */
function quoteSize(n: number) {
  if (n < 100) return "text-[22px]/[1.42] shell:text-[28px]/[1.4]";
  if (n > 260) return "text-[17px]/[1.6] shell:text-[19px]/[1.6]";
  return "text-[19px]/[1.52] shell:text-[23px]/[1.5]";
}

/**
 * The passage of the day on Home (home-spec §2 Home 3): the quote alone, as
 * it sits on the page in the book (highlighted, on a page panel), with its
 * day and line of context above and the book below. The quote, the book and
 * "Read in the book" all open the reader at the passage; Share makes the
 * quote an image.
 */
export default function PassageCard({ passage }: { passage: HomePassage }) {
  const { book } = passage;
  const shareQuote = useShareQuote(book.title, book.author, book.cover);
  return (
    <article className="flex flex-col gap-4 rounded-sm border border-[var(--color-app-border)] bg-[var(--reader-bg)] p-5 text-[var(--color-app-text)] shell:gap-5 shell:p-7">
      <header className="flex flex-wrap items-baseline gap-2">
        <span className="text-ui-xs tracking-eyebrow uppercase text-[var(--color-app-brand)]">Passage of the day</span>
        <span className="text-ui-caption text-[var(--color-app-text-muted)]">{passage.day}</span>
      </header>

      {passage.context && (
        <p className="m-0 max-w-[62ch] text-[14px]/[1.5] text-pretty text-[var(--color-app-text-secondary)]">
          {passage.context.label && <span className="font-bold text-[var(--color-app-text)]">{passage.context.label} · </span>}
          {passage.context.text}
        </p>
      )}

      <ReaderLink href={passage.href} className="block rounded-sm bg-[var(--color-app-inset)] px-5 py-5 text-[var(--color-app-text)] no-underline shell:px-8 shell:py-7">
        <span aria-hidden className="-mt-0.5 mb-1.5 block h-7 font-serif text-[56px]/none font-semibold text-brand-500 select-none shell:h-8 shell:text-[64px]">
          &ldquo;
        </span>
        <span className={`block font-serif text-pretty ${quoteSize(passage.excerpt.length)}`}>
          <span className="bg-[color-mix(in_srgb,var(--color-brand-400)_22%,transparent)] px-[3px] py-[2px] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
            {passage.excerpt}
          </span>
        </span>
      </ReaderLink>

      <div className="flex flex-col gap-4">
        <ReaderLink href={passage.href} className="flex min-w-0 items-center gap-3 text-inherit no-underline">
          <BookCover src={book.cover} alt="" materialType={book.materialType} iconSize={16} className="aspect-2/3 w-10 flex-none rounded-xs ring-1 ring-sand-950/8" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="line-clamp-2 text-[14px]/[1.3] font-semibold text-pretty text-[var(--color-app-text)]">{book.title}</span>
            <span className="text-ui-caption text-[var(--color-app-text-secondary)]">{[book.author, passage.where].filter(Boolean).join(" · ")}</span>
          </span>
        </ReaderLink>
        <div className="flex gap-2 whitespace-nowrap">
          <ReaderLink
            href={passage.href}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-sm bg-brand-500 shell:flex-none px-4 text-[13px] font-bold text-white no-underline transition-colors hover:bg-brand-600"
          >
            Read in the book
          </ReaderLink>
          <button
            type="button"
            onClick={() => shareQuote.share(passage.excerpt)}
            className="inline-flex h-9 flex-1 cursor-pointer items-center shell:flex-none justify-center gap-1.5 rounded-sm border border-[var(--color-app-border)] bg-transparent px-4 text-[13px] font-semibold text-[var(--color-app-text)] transition-colors hover:bg-[var(--color-app-inset)]"
          >
            <Share size={15} /> Share
          </button>
        </div>
      </div>
      {shareQuote.modal}
    </article>
  );
}

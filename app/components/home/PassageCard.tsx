"use client";

import { ArrowUpRight, Share } from "lucide-react";
import ReaderLink from "@/app/components/ReaderLink";
import PassageQuote from "@/app/components/rooms/PassageQuote";
import type { HomePassage } from "@/lib/rooms/types";
import { useShareQuote } from "@/app/components/reader/ShareQuoteModal";

/** The quote's size by its length: a short line large, a long one smaller. */
function quoteSize(n: number) {
  if (n < 100) return "text-[22px]/[1.42] shell:text-[28px]/[1.4]";
  if (n > 260) return "text-[17px]/[1.6] shell:text-[19px]/[1.6]";
  return "text-[19px]/[1.52] shell:text-[23px]/[1.5]";
}

const ICON_BUTTON =
  "inline-flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-sm border-none bg-transparent text-[var(--color-app-text-secondary)] transition-colors hover:bg-[var(--color-app-inset)] hover:text-[var(--color-app-text)]";

/**
 * The passage of the day on Home (home-spec §2 Home 3): its day with Share
 * and Read in the book as icons, the context (an anniversary's label on its
 * own row), the quote in the rooms' passage card (PassageQuote), highlighted
 * and sized by length, and the book. The quote and the book open the reader
 * at the passage too; Share makes the quote an image.
 */
export default function PassageCard({ passage }: { passage: HomePassage }) {
  const { book } = passage;
  const shareQuote = useShareQuote(book.title, book.author);
  return (
    <article className="flex flex-col gap-4 rounded-sm border border-[var(--color-app-border)] bg-[var(--reader-bg)] p-4 text-[var(--color-app-text)] shell:p-5">
      <header className="-my-1.5 -mr-1.5 flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-baseline gap-2">
          <span className="text-ui-xs tracking-eyebrow uppercase text-[var(--color-app-brand)]">Passage of the day</span>
          <span className="text-ui-caption text-[var(--color-app-text-muted)]">{passage.day}</span>
        </span>
        <span className="flex flex-none items-center">
          <button type="button" aria-label="Share" title="Share" onClick={() => shareQuote.share(passage.excerpt)} className={ICON_BUTTON}>
            <Share size={16} aria-hidden />
          </button>
          <ReaderLink href={passage.href} aria-label="Read in the book" title="Read in the book" className={`${ICON_BUTTON} no-underline`}>
            <ArrowUpRight size={16} aria-hidden />
          </ReaderLink>
        </span>
      </header>

      {passage.context && (
        <div className="flex max-w-[62ch] flex-col gap-0.5 text-[14px]/[1.5] text-pretty text-[var(--color-app-text-secondary)]">
          {passage.context.label && <span className="font-bold text-[var(--color-app-text)]">{passage.context.label}</span>}
          <span>{passage.context.text}</span>
        </div>
      )}

      <ReaderLink href={passage.href} className="block no-underline">
        <PassageQuote excerpt={passage.excerpt} size={quoteSize(passage.excerpt.length)} highlight />
      </ReaderLink>

      <ReaderLink href={passage.href} className="flex min-w-0 flex-col gap-0.5 text-inherit no-underline">
        <span className="line-clamp-2 text-[14px]/[1.3] font-semibold text-pretty text-[var(--color-app-text)]">{book.title}</span>
        <span className="text-ui-caption text-[var(--color-app-text-secondary)]">{[book.author, passage.where].filter(Boolean).join(" · ")}</span>
      </ReaderLink>
      {shareQuote.modal}
    </article>
  );
}

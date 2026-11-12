"use client";

import { Share } from "lucide-react";
import { useShareQuote } from "@/app/components/reader/ShareQuoteModal";

/** Share: the quote as the passage-of-the-day image card (seo-spec C4). */
export default function QuoteShare({ text, title, author, label = false }: { text: string; title: string; author: string; label?: boolean }) {
  const shareQuote = useShareQuote(title, author);
  return (
    <>
      <button
        type="button"
        aria-label="Share"
        title="Share"
        onClick={() => shareQuote.share(text)}
        className={
          label
            ? "flex cursor-pointer items-center gap-1.5 bg-transparent p-0 [font-size:inherit] font-semibold text-inherit"
            : "flex size-9 flex-none cursor-pointer items-center justify-center rounded-sm text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-muted)] hover:text-[var(--color-app-text)]"
        }
      >
        <Share size={16} strokeWidth={1.75} aria-hidden />
        {label && "Share"}
      </button>
      {shareQuote.modal}
    </>
  );
}

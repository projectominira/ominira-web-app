"use client";

import { useState } from "react";
import { Share } from "lucide-react";
import { readerHref } from "@/app/components/ReaderLink";
import PassageQuote, { BookCite } from "@/app/components/rooms/PassageQuote";
import FistReaction from "@/app/components/rooms/FistReaction";
import { apiFetch } from "@/lib/api/client";
import type { HomePassage } from "@/lib/rooms/types";
import { useShareQuote } from "@/app/components/reader/ShareQuoteModal";

/**
 * The passage of the day on Home (home-spec §2 Home 3), as its note shows
 * in a room (NoteBubble): the room card, "Passage of the day" with its day
 * and Share, the context (an anniversary's label on its own row), the quote
 * (PassageQuote, its ↗ opening the reader at the passage) with the book
 * under it, and the note's fist. Share makes the quote an image. Also the
 * note's own page (NoteView).
 */
export default function PassageCard({ passage }: { passage: HomePassage }) {
  const { book } = passage;
  const shareQuote = useShareQuote(book.title, book.author);
  return (
    <article className="flex w-full flex-col gap-4 rounded-sm bg-[var(--color-app-inset)] px-5 py-5">
      <header className="-my-2 -mr-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-sans text-[11px]/[1.3] font-extrabold tracking-eyebrow text-[var(--color-app-brand)] uppercase">Passage of the day</span>
          <span className="text-ui-caption text-[var(--color-app-text-muted)]">{passage.day}</span>
        </span>
        <button
          type="button"
          aria-label="Share"
          title="Share"
          onClick={() => shareQuote.share(passage.excerpt)}
          className="flex size-9 flex-none cursor-pointer items-center justify-center rounded-sm text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-muted)]"
        >
          <Share size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      {passage.context && (
        <div className="flex max-w-[62ch] flex-col gap-0.5 text-[14px]/[1.5] text-pretty text-[var(--color-app-text-secondary)]">
          {passage.context.label && <span className="font-bold text-[var(--color-app-text)]">{passage.context.label}</span>}
          <span>{passage.context.text}</span>
        </div>
      )}

      <PassageQuote
        excerpt={passage.excerpt}
        href={readerHref(passage.href)}
        cite={<BookCite title={book.title} author={book.author} />}
        footer={passage.reaction && <Fist {...passage.reaction} />}
      />
      {shareQuote.modal}
    </article>
  );
}

/** The note's fist: flips at once, settles on the server's count, and
 * flips back if the save fails. */
function Fist({ postId, count: initialCount, on: initialOn }: NonNullable<HomePassage["reaction"]>) {
  const [state, setState] = useState({ count: initialCount, on: initialOn });
  const toggle = () => {
    const before = state;
    setState({ count: before.count + (before.on ? -1 : 1), on: !before.on });
    apiFetch<{ reactedByMe: boolean; reactionCount: number }>(`/community/notes/${postId}/reactions`, { method: "POST" })
      .then((r) => setState({ count: r.reactionCount, on: r.reactedByMe }))
      .catch(() => setState(before));
  };
  return (
    <div className="flex items-center">
      <FistReaction count={state.count} on={state.on} onToggle={toggle} />
    </div>
  );
}

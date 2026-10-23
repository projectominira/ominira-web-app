"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { communityFeedItemHref } from "@/lib/community/useCommunityFeed";
import { truncateQuote } from "@/app/components/reader/notes/HighlightCard";

/** One quote card for every passage in rooms: the share image's card
 * (ShareQuoteModal) without its logo and url, since this is inside Ominira.
 * A link, a button, or plain; the arrow shows on hover on desktop and
 * always on touch, as main's BookPreview does. Long quotes are cut at the
 * reader's standard preview length, with the same one-way "See more" as
 * every other quote (HighlightCard). */
export default function PassageQuote({
  excerpt,
  cite,
  href,
  onClick,
}: {
  excerpt: string;
  /** The chapter, when there is one: "Ch. 1". */
  cite?: string | null;
  href?: string | null;
  onClick?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { shown, isTruncated } = truncateQuote(excerpt, 0);
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        {/* The opening mark and the arrow share one line, so the quote
            itself runs the card's full width. */}
        <span className="mb-1.5 flex items-start justify-between">
          <span aria-hidden className="font-serif text-[20px]/none text-brand-200 select-none">
            &ldquo;
          </span>
          {(href || onClick) && (
            <ArrowUpRight
              aria-hidden
              size={16}
              className="text-[var(--color-app-text-muted)] opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
            />
          )}
        </span>
        <span className="block font-serif text-[16px]/[1.65] text-pretty text-sand-900">
          {expanded ? excerpt : shown}
          {isTruncated && !expanded && (
            <>
              {" "}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  // The card may itself be a link or a button; expanding is its own action.
                  e.preventDefault();
                  e.stopPropagation();
                  setExpanded(true);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  e.stopPropagation();
                  setExpanded(true);
                }}
                className="cursor-pointer font-sans text-[12px] font-medium text-[var(--color-app-text-secondary)] hover:text-[var(--color-app-text)]"
              >
                See more
              </span>
            </>
          )}
        </span>
        {cite && <span className="mt-1.5 block text-[12px] font-medium text-sand-500">{cite}</span>}
      </span>
    </>
  );
  const cls = "group flex w-full items-start rounded-sm bg-sand-50 px-3.5 py-3 text-left";
  if (href) return <Link href={href} className={cls}>{body}</Link>;
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={`${cls} cursor-pointer`}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}

/** Where a quote opens: the reader over the room, as plain as main's quote
 * cards. The feed link's `note=` would also open the book room beside the
 * book, so it is dropped. */
export function quoteReaderHref(item: Parameters<typeof communityFeedItemHref>[0]) {
  const href = communityFeedItemHref(item);
  if (!href) return null;
  const [path, query = ""] = href.split("?");
  const q = new URLSearchParams(query);
  q.delete("note");
  const rest = q.toString();
  return rest ? `${path}?${rest}` : path;
}

"use client";

import { useState, type ReactNode } from "react";
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
  /** "How Europe Underdeveloped Africa - Walter Rodney · Ch. 1". */
  cite?: string | null;
  href?: string | null;
  onClick?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { shown, isTruncated } = truncateQuote(excerpt, 0);
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span aria-hidden className="mb-1.5 block font-serif text-[20px]/none text-brand-200 select-none">
          &ldquo;
        </span>
        <span className="block font-serif text-[16px]/[1.5] text-pretty text-sand-900">
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
        {cite && <span className="mt-3 block text-[12px] font-medium text-sand-500">{cite}</span>}
      </span>
      {(href || onClick) && (
        <ArrowUpRight
          aria-hidden
          size={16}
          className="mt-0.5 flex-none text-[var(--color-app-text-muted)] opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
        />
      )}
    </>
  );
  const cls = "group flex w-full items-start gap-3 rounded-sm bg-sand-50 p-4 text-left";
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

/** "Title - Author · Ch. 1" from a note's material and label. */
export function passageCite(material: { title: string; author?: string | null } | null | undefined, label: ReactNode | string | null) {
  const book = material ? `${material.title}${material.author ? ` - ${material.author.replace(/[;,\s]+$/, "")}` : ""}` : null;
  return [book, label].filter(Boolean).join(" · ") || null;
}

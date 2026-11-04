"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import BookCover from "@/app/components/shared/BookCover";
import type { MaterialSummary } from "@/lib/api/types";
import { resolveBookThumbnailSrc } from "@/lib/materials/image";

/** `text` with each match of `q` marked. */
export function highlight(text: string, q: string): ReactNode {
  const lowerQ = q.trim().toLowerCase();
  if (!lowerQ) return text;
  const lowerText = text.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let idx = lowerText.indexOf(lowerQ);
  if (idx === -1) return text;
  while (idx !== -1) {
    parts.push(text.slice(cursor, idx));
    parts.push(
      <mark key={idx} style={{ background: "var(--reader-highlight)" }} className="rounded-[2px] text-inherit">
        {text.slice(idx, idx + lowerQ.length)}
      </mark>
    );
    cursor = idx + lowerQ.length;
    idx = lowerText.indexOf(lowerQ, cursor);
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/** A row's footprint while results load, so the list doesn't jump. */
export function BookResultSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 border-b border-[var(--reader-border)] py-3">
      <div className="h-14 w-11 flex-none rounded-sm bg-[var(--reader-surface-hover)]" />
      <div className="min-w-0 flex-1">
        <div className="mb-2 h-3 w-2/3 rounded-full bg-[var(--reader-surface-hover)]" />
        <div className="h-2.5 w-2/5 rounded-full bg-[var(--reader-surface-hover)]" />
      </div>
    </div>
  );
}

const ROW = "flex w-full items-center gap-3 border-b border-[var(--reader-border)] py-3 text-left no-underline";

/**
 * A book in a search list (the library search, the room picker): cover,
 * title and author, the query marked. With `href` it's a link; with
 * `onSelect` a choice: a circle at the right, checked when selected.
 */
export default function BookResultRow({
  material,
  query = "",
  href,
  onSelect,
  selected = false,
}: {
  material: MaterialSummary;
  query?: string;
  href?: string;
  onSelect?: () => void;
  selected?: boolean;
}) {
  const body = (
    <>
      <BookCover
        materialType={material.materialType}
        src={resolveBookThumbnailSrc(material)}
        alt={material.title}
        className="h-14 w-11 flex-none rounded-sm border border-[var(--reader-border)]"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-[var(--reader-text)]">{highlight(material.title, query)}</div>
        <div className="truncate text-xs font-medium text-[var(--reader-text-muted)]">{highlight(material.author, query)}</div>
      </div>
    </>
  );
  if (href)
    return (
      <Link href={href} className={ROW}>
        {body}
      </Link>
    );
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={`${ROW} cursor-pointer border-x-0 border-t-0 bg-transparent px-0`}>
      {body}
      <span
        aria-hidden
        className={`flex size-5.5 flex-none items-center justify-center rounded-full border-[1.5px] ${selected ? "border-brand-500 bg-brand-500 text-white" : "border-[var(--reader-border)]"}`}
      >
        {selected && <Check size={14} strokeWidth={3} />}
      </span>
    </button>
  );
}

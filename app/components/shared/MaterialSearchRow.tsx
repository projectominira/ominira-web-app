import type { ReactNode } from "react";
import BookCover from "@/app/components/shared/BookCover";
import { resolveBookThumbnailSrc } from "@/lib/materials/image";
import type { MaterialSummary } from "@/lib/api/types";

/** Marks every case-insensitive occurrence of `q` in `text`. */
export function highlight(text: string, q: string) {
  if (!q) return text;
  const lowerText = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let idx = lowerText.indexOf(lowerQ, cursor);
  if (idx === -1) return text;
  while (idx !== -1) {
    parts.push(text.slice(cursor, idx));
    parts.push(
      <mark key={idx} style={{ background: "var(--reader-highlight)" }} className="text-inherit rounded-[2px]">
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    cursor = idx + q.length;
    idx = lowerText.indexOf(lowerQ, cursor);
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export const materialRowClass = "flex w-full items-center gap-3 py-3 border-b border-[var(--reader-border)]";

/** The inside of one library search result (SearchModal, the group
 * reading list's From library): cover, highlighted title and author, and an
 * optional trailing slot. The caller supplies the wrapper (link or button)
 * with `materialRowClass`. */
export function MaterialSearchRow({ material, query, trailing }: { material: MaterialSummary; query: string; trailing?: ReactNode }) {
  return (
    <>
      <BookCover
        materialType={material.materialType}
        src={resolveBookThumbnailSrc(material)}
        alt={material.title}
        className="h-14 w-11 flex-none rounded-sm border border-[var(--reader-border)]"
      />
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-[13px] font-semibold text-[var(--reader-text)]">{highlight(material.title, query)}</div>
        {material.author && (
          <div className="truncate text-xs font-medium text-[var(--reader-text-muted)]">{highlight(material.author, query)}</div>
        )}
      </div>
      {trailing}
    </>
  );
}

/** Same footprint as a result row, so the list doesn't jump when results
 * arrive. */
export function MaterialRowSkeleton() {
  return (
    <div className={`${materialRowClass} animate-pulse`}>
      <div className="h-14 w-11 flex-none rounded-sm bg-[var(--reader-surface-hover)]" />
      <div className="min-w-0 flex-1">
        <div className="mb-2 h-3 w-2/3 rounded-full bg-[var(--reader-surface-hover)]" />
        <div className="h-2.5 w-2/5 rounded-full bg-[var(--reader-surface-hover)]" />
      </div>
    </div>
  );
}

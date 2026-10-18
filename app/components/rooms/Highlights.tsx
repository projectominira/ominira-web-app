"use client";

import { Highlighter } from "lucide-react";
import { formatInstant } from "@/lib/time/format";
import type { RoomItem } from "@/lib/rooms/types";

// Highlights in the reader's book room (rooms-spec §2 Reader, 12d / 13d):
// always private. Your own show in the stream, dashed and on your side,
// with how many comrades marked the same line; the Highlights filter lists
// yours and the lines most marked by comrades, never who.

/** Your highlight in the stream: "You highlighted · 21:02", the line, and
 * "Only you · 24 comrades marked this line". */
export function YourHighlight({ item, flash = false }: { item: Extract<RoomItem, { t: "highlight" }>; flash?: boolean }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div
        className={`flex max-w-[88%] flex-col gap-1.5 rounded-lg rounded-tr-2xs border border-dashed border-sand-300 bg-[var(--color-app-surface-muted)] px-3 pt-2 pb-2.5 transition-shadow duration-250 ease-out ${
          flash ? "ring-3 ring-brand-300" : ""
        }`}
      >
        <span className="flex items-center gap-1.5 text-ui-caption font-bold text-[var(--color-app-text-secondary)]">
          <Highlighter size={13} strokeWidth={1.75} aria-hidden />
          You highlighted · {formatInstant(item.at, "time")}
        </span>
        <div className="flex flex-col gap-1 rounded-r-sm border-l-2 border-brand-300 bg-quote-wash pt-2 pr-2.5 pb-1.75 pl-3">
          <span className="font-serif text-[15px]/[1.55] text-pretty">“{item.excerpt}”</span>
          {item.label && <span className="text-ui-caption text-[var(--color-app-text-secondary)]">{item.label}</span>}
        </div>
      </div>
      <span className="text-ui-caption text-[var(--color-app-text-muted)]">
        Only you{item.count > 0 && ` · ${item.count} comrades marked this line`}
      </span>
    </div>
  );
}

export type HighlightRow = { key: string; text: string; cite: string; meta: string; passageId: string };

function Group({ title, rows, mine, onGo }: { title: string; rows: HighlightRow[]; mine: boolean; onGo: (passageId: string) => void }) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 pt-1.5">
      <span className="font-sans text-[11px]/[1.3] font-extrabold tracking-eyebrow text-[var(--color-app-text-muted)] uppercase">{title}</span>
      {rows.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onGo(r.passageId)}
          className={`flex w-full cursor-pointer flex-col gap-1.5 rounded-r-sm border-l-2 pt-2.5 pr-3 pb-2.25 pl-3.5 text-left ${
            mine ? "border-brand-300 bg-quote-wash" : "border-sand-300 bg-[var(--color-app-surface)]"
          }`}
        >
          <span className="font-serif text-[15px]/[1.55] text-pretty">“{r.text}”</span>
          <span className="flex items-center gap-1.5 text-ui-caption text-[var(--color-app-text-secondary)]">
            <span className="flex-1">{r.cite}</span>
            <span className="font-bold">{r.meta}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** The Highlights filter: yours, then the lines most marked by comrades.
 * A row takes the reader to its line. */
export function HighlightList({ yours, most, onGo }: { yours: HighlightRow[]; most: HighlightRow[]; onGo: (passageId: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-ui-caption text-pretty text-[var(--color-app-text-secondary)]">
        Your highlights are only visible to you. Comrades see how many people marked a line, never who.
      </span>
      <Group title="Yours" rows={yours} mine onGo={onGo} />
      <Group title="Most marked by comrades" rows={most} mine={false} onGo={onGo} />
    </div>
  );
}

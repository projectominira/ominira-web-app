"use client";

import Link from "next/link";
import BookCover from "@/app/components/shared/BookCover";
import PulseDot from "@/app/components/shared/PulseDot";
import { chatTime, rowPreview } from "@/lib/rooms/home";
import type { RoomLast } from "@/lib/rooms/types";
import { useNow } from "@/lib/time/useNow";
import { GroupAvatar } from "./RoomAvatar";

/** A row: a book room (its cover) or a study group (its letter). `empty`
 * stands in for the preview while the room has no note; `signal` is the
 * line under the name, in brand when `live`, with a dot when it's happening
 * now. `fresh`: just joined and not opened yet, a brand wash. */
export type RoomRowProps = {
  href: string;
  name: string;
  mark: { group: true } | { group: false; cover: string | null };
  last: RoomLast | null;
  empty?: string;
  unread: number;
  live: boolean;
  signal: { text: string; now: boolean } | null;
  fresh?: boolean;
};

const WASH = "bg-[color-mix(in_srgb,var(--reader-accent)_8%,var(--reader-surface))]";

/**
 * A room as a chat row (home-spec §2 Room row): the cover or the group's
 * letter (a brand ring while live), the name (bold) and its signal line,
 * the preview "{name}: {body}", and the time over the unread count. Unread:
 * the preview in primary and the time in brand. Name and
 * preview keep to a line each; the full name shows on hover.
 */
export default function RoomRow({ href, name, mark, last, empty, unread, live, signal, fresh = false }: RoomRowProps) {
  const now = useNow();
  return (
    <Link
      href={href}
      title={name}
      aria-label={`Open ${name}`}
      className={`-mx-3 flex items-center gap-3 rounded-sm px-3 py-2.5 text-[var(--color-app-text)] no-underline transition-colors hover:bg-[var(--reader-surface-hover)] ${fresh ? WASH : ""}`}
    >
      <span className="relative flex-none">
        {mark.group ? <GroupAvatar name={name} size={44} fontSize={15} /> : <BookCover src={mark.cover} alt="" className="aspect-2/3 w-[30px] rounded-xs ring-1 ring-sand-950/8" iconSize={14} />}
        {live && <span aria-hidden className={`absolute -inset-1 border-2 border-brand-500 ${mark.group ? "rounded-full" : "rounded-sm"}`} />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[13px] font-bold">{name}</span>
        {signal && (
          <span className={`flex min-w-0 items-center gap-1.5 text-ui-caption ${live ? "font-semibold text-[var(--color-app-brand)]" : "text-[var(--reader-text-muted)]"}`}>
            {signal.now && <PulseDot tone={live ? "live" : "forest"} />}
            <span className="truncate">{signal.text}</span>
          </span>
        )}
        {last ? (
          <span className={`truncate text-[13px] ${unread ? "text-[var(--color-app-text)]" : "text-[var(--reader-text-muted)]"}`}>{rowPreview(last)}</span>
        ) : (
          <span className="truncate text-ui-sm text-[var(--reader-text-muted)]">{empty}</span>
        )}
      </span>
      <span className="flex flex-none flex-col items-end gap-1.5 self-stretch pt-0.5">
        {last && <span className={`text-ui-caption ${unread ? "text-[var(--color-app-brand)]" : "text-[var(--reader-text-muted)]"}`}>{chatTime(last.at, now)}</span>}
        {unread > 0 && (
          <span className="h-4.5 min-w-4.5 rounded-full bg-brand-500 px-1.5 text-center font-sans text-[10px]/4.5 font-bold text-sand-25">{unread}</span>
        )}
      </span>
    </Link>
  );
}

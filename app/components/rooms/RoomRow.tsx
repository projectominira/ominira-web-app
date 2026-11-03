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
 * letter (a brand ring while live), the name and its signal line, the
 * preview "{name}: {body}", and the time over the unread count. Unread: the
 * name bolder, the preview in primary and the time in brand. Name and
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
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className={`truncate text-[15px]/[1.4] ${unread ? "font-bold" : "font-semibold"}`}>{name}</span>
        {signal && (
          <span className={`flex min-w-0 items-center gap-1.5 text-ui-caption ${live ? "font-bold text-[var(--color-app-brand)]" : "text-[var(--reader-text-muted)]"}`}>
            {signal.now && <PulseDot tone={live ? "live" : "forest"} />}
            <span className="truncate">{signal.text}</span>
          </span>
        )}
        <span className={`truncate text-ui-body-regular ${unread ? "text-[var(--color-app-text)]" : "text-[var(--color-app-text-secondary)]"}`}>{last ? rowPreview(last) : empty}</span>
      </span>
      <span className="flex flex-none flex-col items-end gap-1.5 self-stretch pt-0.5">
        {last && <span className={`text-ui-caption ${unread ? "text-[var(--color-app-brand)]" : "text-[var(--reader-text-muted)]"}`}>{chatTime(last.at, now)}</span>}
        {unread > 0 && (
          <span className="h-5 min-w-5 rounded-full bg-brand-500 px-1.5 text-center font-sans text-[11px]/5 font-bold text-sand-25">{unread}</span>
        )}
      </span>
    </Link>
  );
}

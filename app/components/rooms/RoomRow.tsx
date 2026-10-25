"use client";

import Link from "next/link";
import BookCover from "@/app/components/shared/BookCover";
import PulseDot from "@/app/components/shared/PulseDot";
import { chatTime, rowSender } from "@/lib/rooms/home";
import type { RoomLast } from "@/lib/rooms/types";
import { useNow } from "@/lib/time/useNow";
import RoomAvatar, { GroupAvatar } from "./RoomAvatar";

/** A row: a book room (its cover) or a study group (its letter). `empty`
 * stands in for the preview while the room has no note; `signal` is the
 * line under it, in brand when `live`, with a dot when it's happening now. */
export type RoomRowProps = {
  href: string;
  name: string;
  mark: { group: true } | { group: false; cover: string | null };
  last: RoomLast | null;
  empty?: string;
  unread: number;
  live: boolean;
  signal: { text: string; now: boolean } | null;
};

/**
 * A room as a chat row (home-spec §2 Room row, U1): the cover or the
 * group's letter, the title, the time, the preview "{name}: {body}", and
 * the signal line, the title bold throughout. Unread: a count, the preview in primary
 * and the time in brand. Live: a brand ring and "Live now · 23 listening".
 */
export default function RoomRow({ href, name, mark, last, empty, unread, live, signal }: RoomRowProps) {
  const now = useNow();
  return (
    <Link
      href={href}
      aria-label={`Open ${name}`}
      className="-mx-2 flex items-center gap-3 px-2 py-2.5 text-[var(--color-app-text)] no-underline transition-colors hover:bg-[var(--reader-surface-hover)]"
    >
      <span className={`flex-none ${live ? `-m-1 border-2 border-brand-500 p-0.5 ${mark.group ? "rounded-full" : "rounded-sm"}` : ""}`}>
        {mark.group ? <GroupAvatar name={name} size={36} fontSize={14} /> : <BookCover src={mark.cover} alt="" className="aspect-2/3 w-9 rounded-xs ring-1 ring-sand-950/8" iconSize={14} />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{name}</span>
          {last && <span className={`flex-none text-ui-caption ${unread ? "text-[var(--color-app-brand)]" : "text-[var(--reader-text-muted)]"}`}>{chatTime(last.at, now)}</span>}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          {last ? (
            <>
              <RoomAvatar comrade={{ readerId: "", pseudonym: last.who, avatar: last.avatar }} size={20} />
              <span className={`min-w-0 flex-1 truncate text-[13px] ${unread ? "text-[var(--color-app-text)]" : "text-[var(--reader-text-muted)]"}`}>
                {rowSender(last)}: {last.text}
              </span>
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate text-ui-sm text-[var(--reader-text-muted)]">{empty}</span>
          )}
          {unread > 0 && (
            <span className="h-4.5 min-w-4.5 flex-none rounded-full bg-brand-500 px-1.5 text-center font-sans text-[10px]/4.5 font-bold text-sand-25">{unread}</span>
          )}
        </span>
        {signal && (
          <span className={`flex items-center gap-1.5 text-ui-caption whitespace-nowrap ${live ? "font-semibold text-[var(--color-app-brand)]" : "text-[var(--reader-text-muted)]"}`}>
            {signal.now && <PulseDot tone={live ? "live" : "forest"} />}
            {signal.text}
          </span>
        )}
      </span>
    </Link>
  );
}

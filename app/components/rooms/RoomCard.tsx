"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Eye, Lock } from "lucide-react";
import type { Note, NoteVisibility } from "@/lib/api/types";
import { chatTime } from "@/lib/rooms/home";
import { pseudonymToSlug } from "@/lib/reader/profileSlug";
import RoomAvatar from "./RoomAvatar";

// The one card every post in a room is: a note (NoteBubble) or a highlight
// (Highlights). Its frame, dotted while private, and its author row: the
// avatar, the name, the time and city, and the privacy chip.

export function RoomCard({ priv, flash = false, children }: { priv: boolean; flash?: boolean; children: ReactNode }) {
  return (
    <article
      className={`flex w-full flex-col gap-3 rounded-sm border bg-[var(--color-app-surface)] px-4 pt-3 pb-3.5 transition-shadow duration-250 ease-out ${flash ? "ring-3 ring-brand-300" : ""} ${
        priv ? "border-dotted border-sand-300" : "border-[var(--color-app-border)]"
      }`}
    >
      {children}
    </article>
  );
}

/** The author row. `onVisibility` makes the chip your switch between
 * public and private; without it the chip only shows on a private card. */
export function CardAuthor({
  author,
  viewerId,
  at,
  now,
  priv,
  official = false,
  tag,
  below,
  menu,
  onVisibility,
}: {
  author: Note["author"];
  viewerId: string | null;
  /** When it was posted; null while still sending ("now"). */
  at: string | null;
  now: number;
  priv: boolean;
  official?: boolean;
  /** "Ominira", "Moderator". */
  tag?: string | null;
  /** Under the name: "in {book}". */
  below?: ReactNode;
  /** The ⋯ at the row's end. */
  menu?: ReactNode;
  onVisibility?: (visibility: NoteVisibility) => void;
}) {
  const mine = author.readerId === viewerId;
  const chip = (
    <>
      {priv ? <Lock size={9} aria-hidden /> : <Eye size={10} aria-hidden />}
      {priv ? "Only you" : "Public"}
    </>
  );
  const chipCls = "flex flex-none items-center gap-0.5 self-center text-[11px] font-semibold text-[var(--reader-text-subtle)]";
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <RoomAvatar comrade={author} size={32} official={official} />
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <div className="flex min-w-0 items-baseline gap-1.5">
          {official ? (
            <span className="min-w-0 truncate text-xs font-bold text-[var(--reader-text)]">{author.pseudonym}</span>
          ) : (
            <Link
              href={`/@${pseudonymToSlug(author.pseudonym)}`}
              className="min-w-0 truncate text-xs font-bold text-[var(--reader-text)] no-underline hover:underline"
            >
              {mine ? "You" : author.pseudonym}
            </Link>
          )}
          {tag && (
            <span className="flex-none self-center rounded-xs bg-[var(--color-app-chip)] px-1.5 py-px font-sans text-[10px]/[1.4] font-bold whitespace-nowrap text-[var(--color-app-text-secondary)]">
              {tag}
            </span>
          )}
          <span className="min-w-0 flex-none truncate text-[12px] font-semibold text-[var(--reader-text-muted)]">
            {at ? chatTime(at, now) : "now"}
            {author.city && ` · ${author.city}`}
          </span>
          {mine && onVisibility ? (
            <button
              type="button"
              onClick={() => onVisibility(priv ? "public" : "private")}
              aria-label={priv ? "Only you can see this. Make it public" : "Comrades can see this. Make it private"}
              className={`${chipCls} -my-1 cursor-pointer rounded-full px-1.5 py-0.5 hover:bg-[var(--color-app-surface-muted)]`}
            >
              {chip}
            </button>
          ) : (
            priv && <span className={chipCls}>{chip}</span>
          )}
        </div>
        {below}
      </div>
      {menu}
    </div>
  );
}

"use client";

import Link from "next/link";
import BookCover from "@/app/components/shared/BookCover";
import { useIsAuthenticated } from "@/lib/auth/useIsAuthenticated";
import { useEnterRoom } from "@/lib/room/useEnterRoom";
import { useOpenRoom } from "@/lib/room/useOpenRoom";
import type { RoomInvite } from "@/lib/room/types";
import { activeRoom, useRoomStore } from "@/stores/room-store";
import { useSessionStore } from "@/stores/session-store";

const SOLID = "flex h-11 w-full items-center justify-center rounded-sm bg-brand-500 px-5 text-[14px] font-bold text-white no-underline transition-colors hover:bg-brand-600 disabled:opacity-60";
const OUTLINE =
  "flex h-11 w-full items-center justify-center rounded-sm border border-[var(--reader-border)] px-5 text-[14px] font-bold text-[var(--reader-text)] no-underline transition-colors hover:bg-[var(--reader-surface-hover)]";

/**
 * A room's link: the book, the room and who's in, then one tap to join —
 * which opens the book with the room on (the tap also lets its audio play).
 * Signed out: log in or sign up, and auth brings you back here
 * (lib/auth/returnTo). Ended: the way into the book.
 */
export default function RoomInviteScreen({ invite }: { invite: RoomInvite }) {
  const hydrated = useSessionStore((s) => s.hasHydrated);
  const signedIn = useIsAuthenticated();
  const inThisRoom = useRoomStore((s) => activeRoom(s)?.room.id === invite.id);
  const { enter, pending } = useEnterRoom();
  const openRoom = useOpenRoom();

  const join = async () => {
    if (inThisRoom || (await enter({ materialId: invite.materialId, join: { id: invite.id, title: invite.title } }, { confirm: false }))) openRoom(invite.materialId);
  };

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[360px] flex-col items-center gap-5 text-center">
        <span className={`block rounded-[10px] border-2 p-1 ${invite.live ? "border-brand-500" : "border-sand-300"}`}>
          <BookCover src={invite.cover} alt="" className="aspect-2/3 w-24 rounded-xs ring-1 ring-sand-950/8" iconSize={24} />
        </span>
        <div className="flex flex-col gap-1.5">
          <span className={`text-[11px] font-extrabold tracking-eyebrow ${invite.live ? "text-[var(--color-app-brand)]" : "text-[var(--reader-text-muted)]"}`}>
            {invite.live ? `LIVE · ${invite.members} LISTENING` : "ENDED"}
          </span>
          <h1 className="m-0 font-serif text-[22px]/[1.25] font-semibold text-balance text-[var(--reader-text)]">{invite.title}</h1>
          <p className="m-0 text-[13px] font-medium text-[var(--reader-text-muted)]">
            {invite.bookTitle}
            {invite.bookAuthor && ` · ${invite.bookAuthor}`}
          </p>
          {invite.host && <p className="m-0 text-[13px] text-[var(--reader-text-muted)]">Started by {invite.host}</p>}
        </div>

        {!invite.live ? (
          <>
            <p className="m-0 text-[13px] text-[var(--reader-text-muted)]">This room has ended. The book is still open to read.</p>
            <Link href={`/library/${invite.bookSlug}`} className={SOLID}>
              Open the book
            </Link>
          </>
        ) : !hydrated ? null : signedIn ? (
          <button type="button" onClick={() => void join()} disabled={pending} className={`${SOLID} cursor-pointer border-none`}>
            {pending ? "Joining…" : inThisRoom ? "Open the room" : "Join the room"}
          </button>
        ) : (
          <div className="flex w-full flex-col gap-2">
            <p className="m-0 mb-1 text-[13px] text-[var(--reader-text-muted)]">Log in or join Ominira to listen in. You’ll come straight back here.</p>
            <Link href="/auth/login" className={SOLID}>
              Log in
            </Link>
            <Link href="/auth/signup" className={OUTLINE}>
              Join Ominira
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

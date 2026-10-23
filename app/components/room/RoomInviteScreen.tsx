"use client";

import Link from "next/link";
import JoinRoomCard from "./JoinRoomCard";
import { JOIN_BUTTON } from "./JoinRoomDialog";
import { useIsAuthenticated } from "@/lib/auth/useIsAuthenticated";
import { useEnterRoom } from "@/lib/room/useEnterRoom";
import { useOpenRoom } from "@/lib/room/useOpenRoom";
import type { RoomInvite } from "@/lib/room/types";
import { activeRoom, useRoomStore } from "@/stores/room-store";
import { useSessionStore } from "@/stores/session-store";

const OUTLINE =
  "flex h-11 w-full items-center justify-center rounded-sm border border-[var(--reader-border)] px-5 text-[14px] font-bold text-[var(--reader-text)] no-underline transition-colors hover:bg-[var(--reader-surface-hover)]";

/**
 * A room's link: the join screen as a page (JoinRoomCard), then one tap to
 * join, which opens the book with the room on (the tap also lets its audio
 * play). Signed out: log in or sign up, and auth brings you back here
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
      <div className="w-full max-w-[540px] rounded-lg border border-[var(--reader-border)] bg-[var(--reader-surface)] p-6">
        <JoinRoomCard title={invite.title} invite={invite}>
          {!invite.live ? (
            <>
              <p className="m-0 text-[13px] text-[var(--reader-text-muted)]">This room has ended. The book is still open to read.</p>
              <Link href={`/library/${invite.bookSlug}`} className={JOIN_BUTTON}>
                Open the book
              </Link>
            </>
          ) : !hydrated ? null : signedIn ? (
            <div className="mt-2 flex flex-col items-center gap-2">
              {!inThisRoom && <p className="m-0 text-xs text-[var(--reader-text-muted)]">Your mic will be off to start</p>}
              <button type="button" onClick={() => void join()} disabled={pending} className={JOIN_BUTTON}>
                {pending ? "Joining…" : inThisRoom ? "Open the room" : "Start listening"}
              </button>
            </div>
          ) : (
            <div className="mt-2 flex w-full flex-col gap-2">
              <p className="m-0 mb-1 text-[13px] text-[var(--reader-text-muted)]">Log in or join Ominira to listen in. You’ll come straight back here.</p>
              <Link href="/auth/login" className={JOIN_BUTTON}>
                Log in
              </Link>
              <Link href="/auth/signup" className={OUTLINE}>
                Join Ominira
              </Link>
            </div>
          )}
        </JoinRoomCard>
      </div>
    </main>
  );
}

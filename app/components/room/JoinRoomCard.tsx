"use client";

import type { ReactNode } from "react";
import { Share, X } from "lucide-react";
import ReaderAvatar from "@/app/components/shared/ReaderAvatar";
import { shareRoom } from "@/lib/room/share";
import type { RoomInvite } from "@/lib/room/types";

const iconButton =
  "flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-[var(--reader-text)] transition-colors hover:bg-[var(--reader-surface-hover)]";

/** A room before you join it, as its link and the join screen show it:
 * close and share, the title over its book, the host and a few others by
 * face, how many more are in, then `children` (Start listening, or the way
 * to sign in). `invite` is null while it loads. */
export default function JoinRoomCard({
  title,
  invite,
  onClose,
  children,
}: {
  title: string;
  invite: RoomInvite | null;
  onClose?: () => void;
  children: ReactNode;
}) {
  const others = invite ? invite.members - invite.people.length : 0;
  return (
    <div className="flex w-full flex-col gap-4">
      {(onClose || invite?.live) && (
        <div className="-mx-2 -mt-2 flex items-center justify-between">
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Close" className={iconButton}>
              <X size={20} strokeWidth={2} />
            </button>
          ) : (
            <span />
          )}
          {invite?.live && (
            <button type="button" onClick={() => void shareRoom(invite)} aria-label="Share the room" title="Share" className={iconButton}>
              <Share size={18} strokeWidth={2} />
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        {invite && (
          <span className={`text-[11px] font-extrabold tracking-eyebrow ${invite.live ? "text-[var(--color-app-brand)]" : "text-[var(--reader-text-muted)]"}`}>
            {invite.live ? `LIVE · ${invite.members} LISTENING` : "ENDED"}
          </span>
        )}
        <h2 className="m-0 text-xl/tight font-bold text-balance text-[var(--reader-text)]">{title}</h2>
        {invite && (
          <p className="m-0 truncate text-[13px] font-medium text-[var(--reader-text-muted)]">
            {invite.bookTitle}
            {invite.bookAuthor && ` · ${invite.bookAuthor}`}
          </p>
        )}
      </div>

      {invite?.live && invite.people.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0">
          {invite.people.map((p) => (
            <li key={p.readerId} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
              <ReaderAvatar pseudonym={p.pseudonym} avatar={p.avatar} size={48} />
              <span className="flex min-w-0 max-w-full flex-col">
                <span className="truncate text-[13px] font-bold text-[var(--reader-text)]">{p.pseudonym}</span>
                <span className="text-xs text-[var(--reader-text-muted)]">{p.readerId === invite.hostId ? "Host" : "Listener"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {others > 0 && (
        <div className="rounded-sm border border-[var(--reader-border)] px-4 py-3 text-[13px] font-bold text-[var(--reader-text)]">
          {others} other {others === 1 ? "listener" : "listeners"}
        </div>
      )}

      {children}
    </div>
  );
}

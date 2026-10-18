"use client";

import type { CSSProperties, ReactNode } from "react";
import type { RoomSession } from "@/lib/rooms/types";
import { SessionCard } from "./ActionCards";

// The book room's Live tab, on the details page and in the reader alike:
// the session's card with Join until you're in, then the room itself (who's
// here and its chat) in the same place. Joining never leaves the page.

/** The live reading room on a book, as the book room shows it. */
export type BookLive = {
  /** The session's card, while one is on. */
  card: RoomSession | null;
  /** You're in it: who's here and its chat, and the chat bar. */
  joined: { stage: ReactNode; composer: ReactNode } | null;
  onJoin?: () => void;
};

/** A tab that isn't the stream: a scrolling body, then a footer (a chat bar). */
export function RoomPage({
  footer,
  maxWidth,
  tinted = false,
  className,
  children,
}: {
  footer?: ReactNode;
  maxWidth?: number;
  /** The stream's sand behind the body. */
  tinted?: boolean;
  className: string;
  children: ReactNode;
}) {
  const cap: CSSProperties | undefined = maxWidth ? { maxWidth } : undefined;
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-[var(--reader-bg)] text-[var(--color-app-text)]">
      <div className={`om-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain ${tinted ? "bg-sand-50" : ""}`}>
        <div style={cap} className={`mx-auto flex flex-col ${className}`}>
          {children}
        </div>
      </div>
      {footer && (
        <div style={cap} className="mx-auto w-full flex-none">
          {footer}
        </div>
      )}
    </div>
  );
}

export function LivePane({ live, viewerId, maxWidth }: { live: BookLive; viewerId: string | null; maxWidth?: number }) {
  if (live.joined) {
    return (
      <RoomPage footer={live.joined.composer} maxWidth={maxWidth} className="gap-3.5 px-5 pt-4 pb-10">
        {live.joined.stage}
      </RoomPage>
    );
  }
  return (
    <RoomPage maxWidth={maxWidth} tinted className="min-h-full items-center justify-center gap-3 px-4 py-6">
      {live.card && (
        <>
          <div className="w-full max-w-95">
            <SessionCard card={live.card} team={false} viewerId={viewerId} onJoin={live.onJoin} />
          </div>
          <p className="m-0 max-w-80 text-center text-ui-caption text-pretty text-[var(--color-app-text-secondary)]">
            Listen along and talk in the chat. Your mic stays off until you turn it on.
          </p>
        </>
      )}
    </RoomPage>
  );
}

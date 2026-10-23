"use client";

import { Hand, MessageCircle, Users } from "lucide-react";
import MicToggle from "./MicToggle";
import UnreadBadge from "./UnreadBadge";
import { ReactButton, RisingReactions } from "./Reactions";
import { useRoom, useRoomControls } from "@/lib/room/hooks";
import type { RoomPlayerView } from "@/stores/layout-store";
import { useRoomStore } from "@/stores/room-store";

// The room panel's footer, as a Space has it: your mic on the left; then
// who's here, your hand, reactions and the chat with how many messages,
// quiet round buttons on the right. Each of the guests and chat buttons
// opens its view, and again goes back to the stage. The reactions tray
// opens centred over the row; what's sent rises over it.

const iconButton =
  "flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full border transition-colors disabled:cursor-default disabled:opacity-50 shell:h-10 shell:w-10";

const idle = "border-[var(--reader-border)] bg-[var(--reader-surface)] text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]";
const active = "border-[var(--reader-accent)] bg-[color-mix(in_srgb,var(--reader-accent)_10%,var(--reader-surface))] text-[var(--reader-accent)]";

/** The way into the room's chat with your unread count, a badge on the
 * icon; `count` shows how many messages beside it instead (the panel's
 * footer). Also the minimised mini-player's. */
export function ChatButton({ onClick, className, count = false, pressed = false }: { onClick: () => void; className: string; count?: boolean; pressed?: boolean }) {
  const unread = useRoom((s) => s.chat.unread) ?? 0;
  const messages = useRoom((s) => s.chat.items.filter((i) => i.kind === "message").length) ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={count ? pressed : undefined}
      aria-label={unread > 0 ? `Open the chat, ${unread} unread` : "Open the chat"}
      title="Chat"
      className={`${className} relative ${pressed || unread > 0 ? active : idle}`}
    >
      <MessageCircle size={18} strokeWidth={1.75} />
      {count ? (
        messages > 0 && <span className="text-[13px] font-bold tabular-nums">{messages > 99 ? "99+" : messages}</span>
      ) : (
        <UnreadBadge count={unread} className="absolute -top-1 -right-1 ring-2 ring-[var(--reader-surface)]" />
      )}
    </button>
  );
}

export default function RoomActions({ view, onView }: { view: RoomPlayerView; onView: (view: RoomPlayerView) => void }) {
  const session = useRoomStore((s) => s.session);
  const controls = useRoomControls();
  if (!controls || !session) return null;
  const { handRaised, connection } = controls;
  const toggle = (to: RoomPlayerView) => onView(view === to ? "stage" : to);

  return (
    <div className="relative flex items-center gap-2">
      <RisingReactions />
      <MicToggle iconOnly className={iconButton} />
      <span className="flex-1" />
      <button
        type="button"
        aria-pressed={view === "guests"}
        aria-label="Everyone in the room"
        title="Guests"
        onClick={() => toggle("guests")}
        className={`${iconButton} ${view === "guests" ? active : idle}`}
      >
        <Users size={18} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        disabled={connection === "connecting"}
        aria-pressed={handRaised}
        aria-label={handRaised ? "Lower your hand" : "Raise your hand"}
        title={handRaised ? "Lower hand" : "Raise hand"}
        onClick={() => (handRaised ? session.lowerHand() : session.raiseHand())}
        className={`${iconButton} ${handRaised ? active : idle}`}
      >
        <Hand size={18} strokeWidth={1.75} />
      </button>
      <ReactButton className={iconButton} disabled={connection === "connecting"} />
      <ChatButton
        count
        pressed={view === "chat"}
        onClick={() => toggle("chat")}
        className="flex h-11 flex-none cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3.5 transition-colors shell:h-10"
      />
    </div>
  );
}

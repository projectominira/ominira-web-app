"use client";

import { Share } from "lucide-react";
import { shareRoom } from "@/lib/room/share";

const LOOK = {
  outline: "h-9 border border-[var(--reader-border)] bg-[var(--reader-surface)] px-3 text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]",
  solid: "h-11 flex-1 border-none bg-brand-500 px-4 text-white hover:bg-brand-600",
};

/** "Invite": the room's link through the share sheet (copied where there's
 * none). Outline in the room panel's header; solid on Home's room card. */
export default function InviteButton({ room, solid = false }: { room: { id: string; bookTitle: string }; solid?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => void shareRoom(room)}
      className={`flex flex-none cursor-pointer items-center justify-center gap-1.5 rounded-sm text-[13px] font-bold transition-colors ${LOOK[solid ? "solid" : "outline"]}`}
    >
      <Share size={15} strokeWidth={2} />
      {solid ? "Invite comrades" : "Invite"}
    </button>
  );
}

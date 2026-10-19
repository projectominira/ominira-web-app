"use client";

import { Share, UserPlus } from "lucide-react";
import InviteDropdown from "@/app/components/shared/InviteDropdown";
import { secondaryButton } from "@/app/components/groups/buttons";
import { errorMessage } from "@/lib/api/client";
import { inviteToRoom } from "@/lib/room/api";
import { shareRoom } from "@/lib/room/share";
import { showToast } from "@/stores/toast-store";

const LOOK = {
  outline: "h-9 border border-[var(--reader-border)] bg-[var(--reader-surface)] px-3 text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]",
  solid: "h-11 flex-1 border-none bg-brand-500 px-4 text-white hover:bg-brand-600",
};

/** "Invite": a dropdown to tag comrades (they're notified) or share the
 * room's link (the share sheet, copied where there's none). A group's room
 * isn't public, so its Invite is the plain share. Outline in the room
 * panel's header; solid on Home's room card. */
export default function InviteButton({ room, solid = false }: { room: { id: string; bookTitle: string; group?: unknown }; solid?: boolean }) {
  const look = `flex flex-none cursor-pointer items-center justify-center gap-1.5 rounded-sm text-[13px] font-bold transition-colors ${LOOK[solid ? "solid" : "outline"]}`;
  if (room.group) {
    return (
      <button type="button" onClick={() => void shareRoom(room)} className={look}>
        <Share size={15} strokeWidth={2} />
        Invite
      </button>
    );
  }
  return (
    <InviteDropdown
      label={solid ? "Invite comrades" : "Invite"}
      icon={UserPlus}
      triggerClassName={look}
      className={solid ? "flex-1" : undefined}
      align={solid ? "left" : "right"}
      ariaLabel={`Invite to ${room.bookTitle}`}
      share={
        <button type="button" onClick={() => void shareRoom(room)} className={secondaryButton}>
          <Share size={15} strokeWidth={2} />
          Share link
        </button>
      }
      send={(ids, done) => void inviteToRoom(room.id, ids).then(done.onSuccess, done.onError)}
      onFail={(err) => showToast(errorMessage(err) ?? "Couldn't send the invite.")}
    />
  );
}

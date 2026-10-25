"use client";

import { Share, UserPlus } from "lucide-react";
import InviteDropdown from "@/app/components/shared/InviteDropdown";
import { secondaryButton } from "@/app/components/groups/buttons";
import { errorMessage } from "@/lib/api/client";
import { inviteToRoom } from "@/lib/room/api";
import { shareRoom } from "@/lib/room/share";
import { showToast } from "@/stores/toast-store";

const LOOK = {
  icon: "h-9 w-9 rounded-full border-none bg-transparent text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]",
  solid: "h-11 flex-1 rounded-sm border-none bg-brand-500 px-4 text-white hover:bg-brand-600",
};

/** "Invite": a dropdown to tag comrades (they're notified) or share the
 * room's link (the share sheet, copied where there's none). A group's room
 * isn't public, so its Invite is the plain share. An icon in the room
 * panel's header; solid on Home's room card. */
export default function InviteButton({ room, solid = false }: { room: { id: string; bookTitle: string; group?: unknown }; solid?: boolean }) {
  const look = `flex flex-none cursor-pointer items-center justify-center gap-1.5 text-[13px] font-bold transition-colors ${LOOK[solid ? "solid" : "icon"]}`;
  if (room.group) {
    return (
      <button type="button" onClick={() => void shareRoom(room)} aria-label="Share the room" title="Share" className={look}>
        <Share size={solid ? 15 : 18} strokeWidth={2} />
        {solid && "Invite"}
      </button>
    );
  }
  return (
    <InviteDropdown
      label={solid ? "Invite comrades" : ""}
      icon={UserPlus}
      iconSize={solid ? 15 : 18}
      anchored={solid}
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

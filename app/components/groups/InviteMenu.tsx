"use client";

import { UserPlus } from "lucide-react";
import ShareButton from "@/app/components/materials/ShareButton";
import InviteDropdown, { InviteSheet } from "@/app/components/shared/InviteDropdown";
import { INFO_TILE } from "@/app/components/rooms/GroupInfo";
import { useInviteToGroup } from "@/lib/groups/hooks";
import { secondaryButton } from "./buttons";
import { onFail } from "./onFail";

/** What a group's invite carries: tagged comrades are notified
 * (`group_invite`, lib/groups/invites.ts); Share link keeps the plain share. */
function useGroupInvite(slug: string, name: string) {
  const invite = useInviteToGroup(slug);
  return {
    ariaLabel: `Invite to ${name}`,
    groupSlug: slug,
    share: <ShareButton title={name} text={`Read with ${name} on Ominira`} ariaLabel="Share a link to this group" label="Share link" className={secondaryButton} />,
    send: (ids: string[], done: { onSuccess: () => void; onError: (err: unknown) => void }) => invite.mutate(ids, done),
    onFail: onFail("Couldn't send the invite."),
  };
}

/** The group info's Invite tile for moderators. */
export default function InviteMenu({ slug, name }: { slug: string; name: string }) {
  return <InviteDropdown icon={UserPlus} triggerClassName={INFO_TILE} iconSize={18} {...useGroupInvite(slug, name)} />;
}

/** The same, opened from the head's ⋮. */
export function GroupInviteSheet({ slug, name, onClose }: { slug: string; name: string; onClose: () => void }) {
  return <InviteSheet {...useGroupInvite(slug, name)} onClose={onClose} />;
}

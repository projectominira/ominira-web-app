"use client";

import { UserPlus } from "lucide-react";
import ShareButton from "@/app/components/materials/ShareButton";
import InviteDropdown from "@/app/components/shared/InviteDropdown";
import { INFO_TILE } from "@/app/components/rooms/GroupInfo";
import { useInviteToGroup } from "@/lib/groups/hooks";
import { secondaryButton } from "./buttons";
import { onFail } from "./onFail";

/** The group info's Invite tile for moderators: tagged comrades are notified
 * (`group_invite`, lib/groups/invites.ts); Share link keeps the plain share. */
export default function InviteMenu({ slug, name }: { slug: string; name: string }) {
  const invite = useInviteToGroup(slug);
  return (
    <InviteDropdown
      icon={UserPlus}
      triggerClassName={INFO_TILE}
      iconSize={20}
      ariaLabel={`Invite to ${name}`}
      groupSlug={slug}
      share={<ShareButton title={name} text={`Read with ${name} on Ominira`} ariaLabel="Share a link to this group" label="Share link" className={secondaryButton} />}
      send={(ids, done) => invite.mutate(ids, done)}
      onFail={onFail("Couldn't send the invite.")}
    />
  );
}

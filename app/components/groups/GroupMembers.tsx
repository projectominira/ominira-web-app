"use client";

import Link from "next/link";
import ReaderAvatar from "@/app/components/shared/ReaderAvatar";
import NoResults from "@/app/components/shared/NoResults";
import type { OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";
import { useGroupMembers, useRemoveMember, useSetMemberRole } from "@/lib/groups/hooks";
import type { GroupMember } from "@/lib/groups/types";
import { comradeName } from "@/lib/reader/authorDisplay";
import { pseudonymToSlug } from "@/lib/reader/profileSlug";
import { confirmAction } from "@/stores/confirm-store";
import { onFail } from "./onFail";
import RowMenu from "./RowMenu";

/** One member's M10 menu: role change and removal. On your own row a
 * moderator can step down; the last moderator is refused by the server. */
function MemberMenu({ slug, member, isSelf }: { slug: string; member: GroupMember; isSelf: boolean }) {
  const setRole = useSetMemberRole(slug);
  const remove = useRemoveMember(slug);
  const name = comradeName(member.pseudonym);

  const changeRole = (role: GroupMember["role"]) =>
    setRole.mutate({ readerId: member.readerId, role }, { onError: onFail("Couldn't change their role.") });
  const onRemove = async () => {
    const ok = await confirmAction({ title: `Remove ${name} from the group?`, confirmLabel: "Remove", danger: true });
    if (ok) remove.mutate(member.readerId, { onError: onFail("Couldn't remove them.") });
  };

  const items: OverflowMenuItem[] = isSelf
    ? member.role === "moderator"
      ? [{ label: "Step down as moderator", onClick: () => changeRole("member") }]
      : []
    : [
        member.role === "member"
          ? { label: "Make moderator", onClick: () => changeRole("moderator") }
          : { label: "Remove as moderator", onClick: () => changeRole("member") },
        { label: "Remove from group", onClick: onRemove, danger: true },
      ];

  return <RowMenu label={`Manage ${name}`} items={items} disabled={setRole.isPending || remove.isPending} />;
}

/** The Members tab (spec §3.1): avatar, name and role. Moderators get the M10 controls in
 * place. */
export default function GroupMembers({
  slug,
  viewerId,
  canManage,
}: {
  slug: string;
  viewerId: string | null;
  canManage: boolean;
}) {
  const { data: members, isLoading } = useGroupMembers(slug);

  if (isLoading) return <div className="h-40" />;
  if (!members || members.length === 0) return <NoResults className="mt-4" message="No members yet." />;

  return (
    <ul className="m-0 list-none p-0">
      {members.map((member) => {
        const isSelf = member.readerId === viewerId;
        return (
          <li key={member.readerId} className="flex items-center gap-3 border-b border-[var(--reader-border)] py-3">
            <Link
              href={`/@${pseudonymToSlug(member.pseudonym)}`}
              className="flex min-w-0 flex-1 items-center gap-3 no-underline"
            >
              <ReaderAvatar pseudonym={member.pseudonym} avatar={member.avatar} size={36} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-semibold text-[var(--reader-text)]">
                  {comradeName(member.pseudonym)}
                  {isSelf && <span className="font-medium text-[var(--reader-text-muted)]"> · you</span>}
                </span>
                <span className="text-xs font-medium text-[var(--reader-text-muted)]">
                  {member.role === "moderator" ? "Moderator" : "Member"}
                </span>
              </span>
            </Link>
            {canManage && <MemberMenu slug={slug} member={member} isSelf={isSelf} />}
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import Link from "next/link";
import { GroupAvatar } from "@/app/components/rooms/RoomAvatar";
import { comradeCount, groupHref } from "@/lib/groups/copy";
import { useJoinAction } from "@/lib/groups/hooks";
import type { GroupCardView } from "@/lib/rooms/types";
import { SECTION_TITLE } from "./StudyGroups";

/** Join without opening the group. */
function JoinButton({ slug, name }: { slug: string; name: string }) {
  const { join, isPending } = useJoinAction(slug);
  return (
    <button
      type="button"
      onClick={join}
      disabled={isPending}
      aria-label={`Join ${name}`}
      className="-mr-3 flex-none cursor-pointer rounded-sm border-0 bg-transparent px-3 py-2 text-ui-md text-[var(--color-app-brand)] transition-colors hover:bg-[color-mix(in_srgb,var(--reader-accent)_10%,transparent)] disabled:opacity-60"
    >
      Join
    </button>
  );
}

/** Public study groups you're not in: the group, what it's reading (else
 * its size), and Join. Joining moves it into Study groups; none, nothing. */
export default function GroupsToJoin({ groups }: { groups: GroupCardView[] }) {
  if (groups.length === 0) return null;
  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <h2 className={`${SECTION_TITLE} flex min-h-9 items-center`}>Groups to join</h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {groups.map((g) => (
          <li key={g.slug} title={g.name} className="flex items-center gap-3 py-2">
            <GroupAvatar name={g.name} size={40} fontSize={14} />
            <Link href={groupHref(g.slug)} className="flex min-w-0 flex-1 flex-col gap-px text-[var(--reader-text)] no-underline">
              <span className="truncate text-ui-md">{g.name}</span>
              <span className="truncate text-ui-caption text-[var(--color-app-text-muted)]">{g.book ? `Reading ${g.book.title}` : comradeCount(g.members)}</span>
            </Link>
            <JoinButton slug={g.slug} name={g.name} />
          </li>
        ))}
      </ul>
    </section>
  );
}

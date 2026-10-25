"use client";

import Link from "next/link";
import { GroupAvatar } from "@/app/components/rooms/RoomAvatar";
import { comradeCount, groupHref } from "@/lib/groups/copy";
import { useJoinAction } from "@/lib/groups/hooks";
import type { GroupCardView } from "@/lib/rooms/types";

/** Join without opening the group; signed out, signup first. */
function JoinLink({ slug, name }: { slug: string; name: string }) {
  const { join, isPending } = useJoinAction(slug);
  return (
    <button type="button" onClick={join} disabled={isPending} aria-label={`Join ${name}`} className="flex-none cursor-pointer border-0 bg-transparent p-0 text-ui-sm font-semibold text-[var(--color-app-brand)] hover:underline disabled:opacity-60">
      Join
    </button>
  );
}

/** Public study groups you're not in, as a plain list in Home's right rail:
 * the group, what it's reading (else its size), and a Join link. */
export default function GroupsToJoin({ groups, className = "" }: { groups: GroupCardView[]; className?: string }) {
  if (groups.length === 0) return null;
  return (
    <section className={`flex flex-col gap-3 ${className}`}>
      <h2 className="m-0 text-ui-caption font-bold tracking-wide text-[var(--color-app-text-muted)] uppercase">Groups to join</h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {groups.map((g) => (
          <li key={g.slug} className="flex items-center gap-3">
            <GroupAvatar name={g.name} size={32} fontSize={13} />
            <Link href={groupHref(g.slug)} className="flex min-w-0 flex-1 flex-col no-underline">
              <span className="truncate text-ui-sm font-semibold text-[var(--reader-text)]">{g.name}</span>
              <span className="truncate text-ui-caption text-[var(--color-app-text-muted)]">{g.book ? `Reading ${g.book.title}` : comradeCount(g.members)}</span>
            </Link>
            <JoinLink slug={g.slug} name={g.name} />
          </li>
        ))}
      </ul>
    </section>
  );
}

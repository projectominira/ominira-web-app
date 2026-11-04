"use client";

import Link from "next/link";
import PulseDot from "@/app/components/shared/PulseDot";
import { GroupAvatar } from "@/app/components/rooms/RoomAvatar";
import { comradeCount, groupHref } from "@/lib/groups/copy";
import { useJoinAction } from "@/lib/groups/hooks";
import type { GroupCardView } from "@/lib/rooms/types";
import { useNow } from "@/lib/time/useNow";
import { signal } from "./GroupRow";
import { ROW_ACTION } from "./StudyGroups";

/** Join without opening the group. */
function JoinButton({ slug, name }: { slug: string; name: string }) {
  const { join, isPending } = useJoinAction(slug);
  return (
    <button type="button" onClick={join} disabled={isPending} aria-label={`Join ${name}`} className={ROW_ACTION}>
      Join
    </button>
  );
}

/** Public study groups you're not in, set like your groups' rows (RoomRow):
 * the name, when it meets (or that it's live), what it's reading and its
 * size, and Join. Joining moves it into Study groups; none, nothing. */
export default function GroupsToJoin({ groups }: { groups: GroupCardView[] }) {
  const now = useNow();
  if (groups.length === 0) return null;
  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <h2 className="m-0 flex min-h-9 items-center text-ui-sm font-semibold text-[var(--reader-text-muted)]">Groups you can join</h2>
      <ul className="m-0 flex list-none flex-col divide-y divide-[var(--color-app-border)] p-0">
        {groups.map((g) => {
          const live = g.live !== null;
          const s = signal(g, now);
          return (
            <li key={g.slug} className="flex items-center gap-3 py-2.5">
              <Link href={groupHref(g.slug)} title={g.name} className="flex min-w-0 flex-1 items-center gap-3 text-[var(--color-app-text)] no-underline">
                <span className="relative flex-none">
                  <GroupAvatar name={g.name} size={44} fontSize={15} />
                  {live && <span aria-hidden className="absolute -inset-1 rounded-full border-2 border-brand-500" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[13px] font-bold">{g.name}</span>
                  {s && (
                    <span className={`flex min-w-0 items-center gap-1.5 text-ui-caption ${live ? "font-semibold text-[var(--color-app-brand)]" : "text-[var(--reader-text-muted)]"}`}>
                      {s.now && <PulseDot tone={live ? "live" : "forest"} />}
                      <span className="truncate">{s.text}</span>
                    </span>
                  )}
                  <span className="truncate text-ui-sm text-[var(--reader-text-muted)]">
                    {g.book ? `Reading ${g.book.title} · ${comradeCount(g.members)}` : comradeCount(g.members)}
                  </span>
                </span>
              </Link>
              <JoinButton slug={g.slug} name={g.name} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import { comradeCount, groupHref, sessionWhen } from "@/lib/groups/copy";
import { sessionPhase } from "@/lib/groups/sessions";
import type { GroupCardView } from "@/lib/rooms/types";
import { useNow } from "@/lib/time/useNow";
import RoomRow, { type RoomRowProps } from "@/app/components/rooms/RoomRow";

/** The line under a group: live, a session on now, when it next meets, or
 * how many it is. */
function signal(g: GroupCardView, now: number): RoomRowProps["signal"] {
  if (g.live !== null) return { text: `Live now · ${g.live} listening`, now: true };
  if (g.nextAt && sessionPhase(Date.parse(g.nextAt), now) === "on") return { text: "Study group · Session on now", now: true };
  return { text: `Study group · ${g.nextAt ? `Meets ${sessionWhen(g.nextAt)}` : comradeCount(g.members)}`, now: false };
}

/** Stands in for the preview while the group has no note: what it's
 * reading, else an invitation. */
function empty({ book }: GroupCardView): string {
  if (!book) return "Be the first to note";
  return `Reading ${book.title}${book.pct !== null ? ` · ${book.pct}% together` : ""}`;
}

/** A study group in Home's chat list. */
export default function GroupRow({ group: g }: { group: GroupCardView }) {
  const now = useNow();
  return (
    <RoomRow
      href={groupHref(g.slug)}
      name={g.name}
      mark={{ group: true }}
      last={g.last}
      empty={empty(g)}
      unread={g.unread}
      live={g.live !== null}
      signal={signal(g, now)}
    />
  );
}

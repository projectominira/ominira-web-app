"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import BookCover from "@/app/components/shared/BookCover";
import PulseDot from "@/app/components/shared/PulseDot";
import { GroupAvatar } from "@/app/components/rooms/RoomAvatar";
import { comradeCount, groupHref, sessionWhen } from "@/lib/groups/copy";
import { useJoinAction } from "@/lib/groups/hooks";
import { sessionPhase } from "@/lib/groups/sessions";
import type { GroupCardView } from "@/lib/rooms/types";
import { useNow } from "@/lib/time/useNow";
import { primaryButton } from "./buttons";

const CARD = "relative flex w-64 flex-none flex-col gap-3.5 rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)] p-4";
const CAPTION = "text-ui-caption text-[var(--color-app-text-muted)]";

/** When it next meets: on now, live, or the day and time. */
function Meets({ card, now }: { card: GroupCardView; now: number }) {
  if (card.live !== null)
    return (
      <span className="flex items-center gap-1.5 text-ui-caption font-semibold text-[var(--color-app-brand)]">
        <PulseDot tone="live" />
        Live now · {card.live} listening
      </span>
    );
  if (!card.nextAt) return <span className={CAPTION}>No session planned</span>;
  const on = sessionPhase(Date.parse(card.nextAt), now) === "on";
  return (
    <span className={`flex items-center gap-1.5 text-ui-caption ${on ? "font-semibold text-[var(--color-app-brand)]" : "text-[var(--color-app-text-secondary)]"}`}>
      <CalendarDays size={14} strokeWidth={2} className="flex-none" />
      {on ? "Session on now" : sessionWhen(card.nextAt)}
    </span>
  );
}

/** Join without opening the group; signed out, signup first. */
function JoinButton({ slug, name }: { slug: string; name: string }) {
  const { join, isPending } = useJoinAction(slug);
  return (
    <button type="button" onClick={join} disabled={isPending} aria-label={`Join ${name}`} className={`relative z-10 h-8 ${primaryButton}`}>
      Join
    </button>
  );
}

/** One group: its letter and size, the book and how far the group has got
 * together, and when it next meets. The whole card opens the group; a group
 * you're not in has Join on it. */
function GroupCard({ card, now }: { card: GroupCardView; now: number }) {
  const { book } = card;
  return (
    <article className={`${CARD} transition-colors hover:border-sand-300`}>
      <div className="flex items-center gap-3">
        <GroupAvatar name={card.name} size={40} fontSize={16} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Link href={groupHref(card.slug)} className="truncate font-serif text-[16px]/[1.3] font-semibold text-[var(--reader-text)] no-underline after:absolute after:inset-0 after:content-['']">
            {card.name}
          </Link>
          <span className={CAPTION}>{comradeCount(card.members)}</span>
        </div>
        {card.unread > 0 && (
          <span aria-label={`${card.unread} new`} className="h-5 min-w-5 flex-none rounded-full bg-brand-500 px-1.5 text-center font-sans text-[11px]/5 font-bold text-sand-25">
            {card.unread}
          </span>
        )}
      </div>

      {book ? (
        <div className="flex items-center gap-3">
          <BookCover src={book.cover} alt="" className="aspect-2/3 w-9 flex-none rounded-xs ring-1 ring-sand-950/8" iconSize={14} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="truncate text-ui-sm font-semibold text-[var(--reader-text)]">{book.title}</span>
            {book.pct !== null ? (
              <>
                <span className="h-1 overflow-hidden rounded-full bg-sand-200">
                  <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.max(2, book.pct)}%` }} />
                </span>
                <span className={CAPTION}>{[book.chapter, `${book.pct}% together`].filter(Boolean).join(" · ")}</span>
              </>
            ) : (
              <span className={CAPTION}>No one’s started yet</span>
            )}
          </div>
        </div>
      ) : (
        <span className={CAPTION}>{card.joined ? "No book chosen yet" : "Choosing its first book"}</span>
      )}

      <div className="mt-auto flex min-h-8 items-center justify-between gap-2">
        <Meets card={card} now={now} />
        {!card.joined && <JoinButton slug={card.slug} name={card.name} />}
      </div>
    </article>
  );
}

/** Study groups to join on Home, in one row that scrolls sideways. Your
 * own groups are rows in Home's chat list; "Start a study group" is the ＋
 * beside Community. */
export default function GroupCards({ cards }: { cards: GroupCardView[] }) {
  const now = useNow();
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] shell:mx-0 shell:px-0 [&::-webkit-scrollbar]:hidden">
      {cards.map((c) => (
        <GroupCard key={c.slug} card={c} now={now} />
      ))}
    </div>
  );
}

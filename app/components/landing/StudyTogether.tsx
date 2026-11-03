import Link from "next/link";
import { BookOpen, Headphones, Mic, Users } from "lucide-react";
import BookCover from "@/app/components/shared/BookCover";
import { GroupAvatar } from "@/app/components/rooms/RoomAvatar";
import { groupHref } from "@/lib/groups/copy";
import type { LandingBook } from "@/lib/landing/view";
import type { GroupCardView, StatusItem } from "@/lib/rooms/types";
import Cover from "./Cover";
import { SECTION_TITLE } from "./styles";

const EYEBROW = "flex items-center gap-2.5 text-ui-xs tracking-eyebrow whitespace-nowrap uppercase";
const CARD_TITLE = "m-0 font-serif text-[24px]/[1.25] font-semibold";
/** A row's call to action, quiet so a list of them doesn't shout: an
 * outlined verb that takes the brand colour as its row is hovered (the
 * whole row is the link); the icon alone on a phone. */
const CTA = "flex h-8 min-w-8 flex-none items-center justify-center gap-1.5 rounded-sm border px-2 text-ui-sm transition-colors sm:px-3";

function ReadAlong() {
  return (
    <span className={`${CTA} border-[var(--color-app-border)] bg-[var(--reader-bg)] text-[var(--reader-text)] group-hover:border-brand-500 group-hover:text-brand-500`}>
      <BookOpen size={15} aria-hidden />
      <span className="hidden sm:inline">Read along</span>
    </span>
  );
}

function ListenIn() {
  return (
    <span className={`${CTA} border-white/16 text-sand-25 group-hover:border-brand-300 group-hover:text-brand-300`}>
      <Headphones size={15} aria-hidden />
      <span className="hidden sm:inline">Listen in</span>
    </span>
  );
}

const ROW = "group flex items-center gap-3.5 rounded-sm p-3 no-underline";
const THUMB = "aspect-2/3 w-14 flex-none rounded-xs";
/** A sample's cover: the landing's own, a touch bigger than a list thumb. */
const SAMPLE_COVER = "w-14 flex-none";

/** Shown while no group is public, on samples[0] and [1]. */
const SAMPLE_GROUPS = [
  { name: "Fanon Fridays", members: 14, pace: "One chapter a week" },
  { name: "Rodney reading circle, Lagos", members: 9, pace: "Two chapters a week" },
];
/** Shown while no room is live, on samples[2] and [3]. */
const SAMPLE_ROOMS = [
  { title: "Biko, chapter 4", host: "Xuma", listeners: 11 },
  { title: "Reading Nkrumah aloud", host: "Bukola", listeners: 23 },
];

/** Study together: public study groups, and the reading rooms live now;
 * with none, sample ones show what they're like. A row opens its group
 * or room (a sample's, sign-up). */
export default function StudyTogether({ live, groups, samples }: { live: StatusItem[]; groups: GroupCardView[]; samples: LandingBook[] }) {
  const sampleGroups = SAMPLE_GROUPS.flatMap((g, i) => (samples[i] ? [{ ...g, book: samples[i] }] : []));
  const sampleRooms = SAMPLE_ROOMS.flatMap((r, i) => (samples[i + 2] ? [{ ...r, book: samples[i + 2] }] : []));
  return (
    <section className="px-5 py-12 md:px-[clamp(20px,4vw,56px)] md:py-[clamp(48px,6vw,96px)]">
      <div className="mx-auto flex max-w-[1328px] flex-col gap-7">
        <div className="flex flex-col gap-2">
          <h2 className={SECTION_TITLE}>Study together</h2>
          <p className="m-0 font-serif text-[17px]/[1.7] text-[var(--color-app-text-secondary)]">Consciousness is built together. Find your comrades.</p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-4.5 rounded-sm border border-[var(--color-app-border)] p-5 md:p-8">
            <div className={`${EYEBROW} text-[var(--color-app-brand)]`}>
              <Users size={20} />
              Study groups
            </div>
            <h3 className={CARD_TITLE}>Read a book with comrades, at your pace</h3>
            {groups.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {groups.map((g) => (
                  <Link key={g.slug} href={groupHref(g.slug)} className={`${ROW} bg-[var(--color-app-surface-muted)] text-[var(--reader-text)] transition-[filter] hover:brightness-[0.97]`}>
                    {g.book ? (
                      <BookCover src={g.book.cover} alt="" className={`${THUMB} shadow-sm`} />
                    ) : (
                      <GroupAvatar name={g.name} size={44} fontSize={15} />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="truncate text-ui-md">{g.name}</span>
                      <span className="truncate text-ui-caption text-[var(--color-app-text-secondary)]">
                        {g.members} {g.members === 1 ? "member" : "members"}
                        {g.book && (
                          <>
                            {" · Reading "}
                            <span className="font-serif italic">{g.book.title}</span>
                          </>
                        )}
                      </span>
                    </span>
                    <ReadAlong />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {sampleGroups.map((g) => (
                  <Link key={g.name} href="/auth/signup" className={`${ROW} bg-[var(--color-app-surface-muted)] text-[var(--reader-text)] transition-[filter] hover:brightness-[0.97]`}>
                    <Cover book={g.book} link={false} className={SAMPLE_COVER} shadow="shadow-sm" />
                    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="truncate text-ui-md">{g.name}</span>
                      <span className="truncate text-ui-caption text-[var(--color-app-text-secondary)]">
                        {g.members} members · Reading <span className="font-serif italic">{g.book.title}</span>
                      </span>
                    </span>
                    <ReadAlong />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4.5 rounded-sm bg-sand-950 p-5 text-sand-25 md:p-8">
            <div className={`${EYEBROW} text-brand-300`}>
              <Mic size={20} />
              Reading rooms
            </div>
            <h3 className={CARD_TITLE}>Read along together, live</h3>
            {live.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {live.map((r) => (
                  <Link key={r.room?.id ?? r.id} href={`/library/${r.id}`} className={`${ROW} bg-sand-900 text-sand-25`}>
                    <BookCover src={r.cover} alt="" className={THUMB} />
                    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="truncate text-ui-md">{r.room?.title ?? r.name}</span>
                      <span className="truncate text-ui-caption text-brand-300">Live now · {r.count} listening</span>
                    </span>
                    <ListenIn />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {sampleRooms.map((r) => (
                  <Link key={r.title} href="/auth/signup" className={`${ROW} bg-sand-900 text-sand-25`}>
                    <Cover book={r.book} link={false} className={SAMPLE_COVER} shadow="shadow-none" />
                    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="truncate text-ui-md">{r.title}</span>
                      <span className="truncate text-ui-caption text-brand-300">
                        {r.host} reading · {r.listeners} listening
                      </span>
                    </span>
                    <ListenIn />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

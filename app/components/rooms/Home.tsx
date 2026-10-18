"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Mic, Users } from "lucide-react";
import UnderlineTabs from "@/app/components/UnderlineTabs";
import GroupCards from "@/app/components/groups/GroupCards";
import BookCover from "@/app/components/shared/BookCover";
import { comradeCount, groupHref, sessionWhen } from "@/lib/groups/copy";
import { sessionPhase } from "@/lib/groups/sessions";
import { resolveBookCoverSrc } from "@/lib/materials/image";
import { byLatest, rowSignal } from "@/lib/rooms/home";
import type { FeaturedRow, GroupCardView, HomeView, RoomRowView, StatusItem } from "@/lib/rooms/types";
import { useNow } from "@/lib/time/useNow";
import InviteButton from "@/app/components/room/InviteButton";
import NewMenu from "./NewMenu";
import RoomRow, { type RoomRowProps } from "./RoomRow";
import StatusStrip from "./StatusStrip";
import PassageCard from "./PassageCard";
import TodayCard from "./TodayCard";

/** Featured books, standing alone near the top: 150 px covers sideways,
 * each with its title and author, opening the book's page. */
function Featured({ rows }: { rows: FeaturedRow[] }) {
  return (
    <section>
      <h2 className="font-serif type-3 m-0 mb-5 text-balance text-[var(--reader-text)]">Featured books</h2>
      <div className="flex gap-4 overflow-x-auto pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.map(({ material: m }) => (
          <Link key={m.id} href={`/library/${m.slug}`} className="group block w-[150px] flex-none no-underline">
            <div className="h-[225px] w-[150px] overflow-hidden rounded-sm border border-[var(--reader-border)] shadow-md">
              <BookCover materialType={m.materialType} src={resolveBookCoverSrc(m)} alt={m.title} className="h-full w-full" />
            </div>
            <div className="mt-2.5 text-[12px] leading-tight font-bold text-[var(--reader-text)] group-hover:text-brand-500">{m.title}</div>
            <div className="mt-0.5 text-[11px] font-semibold text-[var(--reader-text-muted)]">{m.author}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

const H2 = "m-0 font-serif type-3 text-[var(--reader-text)]";
/** Which rooms the chat list shows. */
type Filter = "all" | "groups" | "books" | "unread";

/** A group's signal line: live, a session on now, when it next meets, or
 * how many it is. */
function groupSignal(c: GroupCardView, now: number): RoomRowProps["signal"] {
  if (c.live !== null) return { text: `Live now · ${c.live} listening`, now: true };
  if (c.nextAt && sessionPhase(Date.parse(c.nextAt), now) === "on") return { text: "Study group · Session on now", now: true };
  return {
    text: `Study group · ${c.nextAt ? `Meets ${sessionWhen(c.nextAt)}` : comradeCount(c.members)}`,
    now: false,
  };
}

/** A group with no notes yet: what it's reading, else an invitation. */
const groupEmpty = ({ book }: GroupCardView) => (book ? `Reading ${book.title}${book.pct !== null ? ` · ${book.pct}% together` : ""}` : "Be the first to note");

/** Conversations: one chat list of the rooms you can talk in — your study
 * groups pinned first, then every book room with a note you can read, each
 * the latest first — narrowed by the filter chips. */
function Conversations({ groups, rooms, filter }: { groups: GroupCardView[]; rooms: RoomRowView[]; filter: Filter }) {
  const now = useNow();
  const shownGroups = filter === "books" ? [] : filter === "unread" ? groups.filter((g) => g.unread > 0) : groups;
  const shownRooms = filter === "groups" ? [] : filter === "unread" ? rooms.filter((r) => r.unread > 0) : rooms;
  return (
    <div className="flex flex-col divide-y divide-[var(--reader-border)]">
      {byLatest(shownGroups).map((c) => (
        <RoomRow
          key={`g:${c.slug}`}
          href={groupHref(c.slug)}
          name={c.name}
          mark={{ group: true }}
          last={c.last}
          empty={groupEmpty(c)}
          unread={c.unread}
          live={c.live !== null}
          signal={groupSignal(c, now)}
        />
      ))}
      {shownRooms.map((r) => {
        const signal = rowSignal(r);
        return (
          <RoomRow
            key={`b:${r.slug}`}
            href={`/library/${r.slug}?tab=room`}
            name={r.name}
            mark={{ group: false, cover: r.cover }}
            last={r.last}
            unread={r.unread}
            live={r.live !== null}
            signal={signal ? { text: signal, now: true } : null}
          />
        );
      })}
    </div>
  );
}

/** The tabs: All, then each kind you have, and Unread with its count. */
function filters(groups: GroupCardView[], rooms: RoomRowView[]): { value: Filter; label: ReactNode }[] {
  const unread = groups.filter((g) => g.unread > 0).length + rooms.filter((r) => r.unread > 0).length;
  return [
    { value: "all" as const, label: "All" },
    ...(groups.length ? [{ value: "groups" as const, label: "Groups" }] : []),
    ...(rooms.length ? [{ value: "books" as const, label: "Books" }] : []),
    ...(unread
      ? [
          {
            value: "unread" as const,
            label: (
              <>
                Unread
                <span className="ml-1.5 h-4 min-w-4 rounded-full bg-brand-500 px-1 text-center text-[10px]/4 font-bold text-sand-25">{unread}</span>
              </>
            ),
          },
        ]
      : []),
  ];
}

const TINT = "bg-[color-mix(in_srgb,var(--reader-accent)_10%,var(--reader-surface))]";

/** The room you're in: invite comrades, or go back into it. */
function MyRoomCard({ room, onOpen }: { room: { id: string; title: string; bookTitle: string }; onOpen?: () => void }) {
  return (
    <section className={`flex flex-col gap-3 rounded-sm p-4 ${TINT}`}>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-extrabold tracking-eyebrow text-[var(--color-app-brand)]">YOU’RE IN A ROOM</span>
        <h3 className="m-0 font-serif text-[17px] font-semibold text-[var(--reader-text)]">{room.title}</h3>
      </div>
      <div className="flex gap-2">
        <InviteButton room={room} solid />
        <button
          type="button"
          onClick={onOpen}
          className="h-11 cursor-pointer rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)] px-4 text-[13px] font-bold text-[var(--reader-text)] transition-colors hover:bg-[var(--reader-surface-hover)]"
        >
          Open
        </button>
      </div>
    </section>
  );
}

/**
 * Home (home-spec §2 Home): Featured books, Today — the book you're
 * reading and today's reading — and Community, every place comrades read
 * and talk together, with a ＋ beside its heading (NewMenu) for "Start a
 * reading room" and "Start a study group": the rooms live now and the one
 * you're in (with its Invite), filter tabs, one chat list (your study
 * groups, then the book rooms), and the study groups to join. Desktop: Featured, then Community
 * beside Today. Mobile keeps the live rooms on top, like stories, then
 * Featured, Today and the rest of Community. No view yet: the 28 px
 * spinner, or a line when it failed.
 */
export default function Home({
  view,
  failed = false,
  desktop = false,
  entering = false,
  onSaveGoal,
  onPickRoom,
  onStartRoom,
  onStartGroup,
  myRoom,
  onOpenRoom,
}: {
  view: HomeView | undefined;
  failed?: boolean;
  desktop?: boolean;
  /** Joining or starting a room: the strip waits. */
  entering?: boolean;
  onSaveGoal?: (goal: number) => void;
  onPickRoom?: (item: StatusItem) => void;
  /** "Start a room"; none signed out. */
  onStartRoom?: () => void;
  /** "Start a study group"; none signed out. */
  onStartGroup?: () => void;
  /** The room you're in, for its card: Invite and back into it. */
  myRoom?: { id: string; title: string; bookTitle: string } | null;
  onOpenRoom?: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  if (!view)
    return (
      <div className="flex flex-1 items-center justify-center p-4 py-16">
        {failed ? (
          <p className="text-ui-body text-[var(--color-app-text-secondary)]">Home didn’t load. Try again in a moment.</p>
        ) : (
          <div role="status" aria-label="Loading" className="size-7 animate-spin rounded-full border-[2.5px] border-sand-200 border-t-brand-500" />
        )}
      </div>
    );

  const today = <TodayCard current={view.current} start={view.featured[0]?.material ?? null} streak={view.streak} today={view.today} desktop={desktop} onSaveGoal={onSaveGoal} />;
  const rooms = (view.strip.length > 0 || myRoom) && (
    <div className="flex flex-col gap-4">
      {view.strip.length > 0 && <StatusStrip items={view.strip} onPick={onPickRoom ?? (() => {})} disabled={entering} className={desktop ? "" : "-mb-2 pt-1 pb-1"} />}
      {myRoom && <MyRoomCard room={myRoom} onOpen={onOpenRoom} />}
    </div>
  );
  const joined = view.groups.filter((g) => g.joined);
  const open = view.groups.filter((g) => !g.joined);
  const talk = joined.length > 0 || view.rooms.length > 0;
  const chips = filters(joined, view.rooms);
  const community = ((desktop && rooms) || talk || open.length > 0 || onStartRoom || onStartGroup) && (
    <section className="flex flex-col gap-5 self-start">
      <div className="flex items-center justify-between gap-3">
        <h2 className={H2}>Community</h2>
        <NewMenu
          desktop={desktop}
          disabled={entering}
          actions={[
            ...(onStartRoom ? [{ label: "Start a reading room", sub: "Read a book aloud, live, with comrades", icon: <Mic size={19} />, onClick: onStartRoom }] : []),
            ...(onStartGroup ? [{ label: "Start a study group", sub: "Read a book together, on a schedule", icon: <Users size={19} />, onClick: onStartGroup }] : []),
          ]}
        />
      </div>
      {desktop && rooms}
      {chips.length > 2 && <UnderlineTabs options={chips} value={filter} onChange={setFilter} />}
      {talk && <Conversations groups={joined} rooms={view.rooms} filter={filter} />}
      {open.length > 0 && (filter === "all" || filter === "groups") && <GroupCards cards={open} />}
    </section>
  );
  return (
    <div className="flex flex-col gap-7 pb-4 shell:gap-10">
      {!desktop && rooms}
      {view.featured.length > 0 && <Featured rows={view.featured} />}
      <div className="grid grid-cols-1 gap-7 shell:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] shell:gap-x-12">
        <div className="flex flex-col gap-6 shell:col-start-2 shell:row-start-1">
          {today}
          {desktop && view.passage && <PassageCard passage={view.passage} />}
        </div>
        {community && <div className="min-w-0 shell:col-start-1 shell:row-start-1">{community}</div>}
      </div>
    </div>
  );
}

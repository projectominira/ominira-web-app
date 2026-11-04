"use client";

import type { HomeView, StatusItem } from "@/lib/rooms/types";
import ForYou from "./ForYou";
import GroupsToJoin from "./GroupsToJoin";
import PassageCard from "./PassageCard";
import { BookCard, DailyCard } from "./ReadingCards";
import StatusStrip from "./StatusStrip";
import StudyGroups from "./StudyGroups";

/**
 * Home, signed in (home-spec §2 Home), laid out from its sections:
 *   StatusStrip  — the rooms live now
 *   BookCard     — the book you're reading, opening to the others (or, new,
 *                  the first Featured as "Start here"); DailyCard — today's reading
 *   ForYou       — books picked for you; hidden while we know too little
 *   StudyGroups  — your groups, and starting a group or a room
 *   GroupsToJoin — public groups you're not in
 *   PassageCard  — the passage of the day, desktop only
 * Mobile: one column, your groups before For you. Desktop: the book beside
 * today's reading; then one panel (half) of your groups over groups to join, beside
 * a side column of the passage and For you. With neither, groups to join
 * moves into the side column; with nothing to move, the panel stops at
 * 720px. No view yet: a spinner, or a line when it failed.
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
}: {
  view: HomeView | undefined;
  failed?: boolean;
  desktop?: boolean;
  /** Joining or starting a room: the strip waits. */
  entering?: boolean;
  onSaveGoal: (goal: number) => void;
  onPickRoom: (item: StatusItem) => void;
  onStartRoom: () => void;
  onStartGroup: () => void;
}) {
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

  const joined = view.groups.filter((g) => g.joined);
  const toJoin = view.groups.filter((g) => !g.joined);
  const live = view.strip.length > 0 && <StatusStrip items={view.strip} onPick={onPickRoom} disabled={entering} className="pb-1" />;
  const book = <BookCard current={view.current} start={view.start} desktop={desktop} />;
  const daily = <DailyCard streak={view.streak} today={view.today} desktop={desktop} onSaveGoal={onSaveGoal} />;
  const forYou = <ForYou books={view.forYou} desktop={desktop} />;
  const groups = (
    <StudyGroups groups={joined} rooms={view.rooms} joinable={toJoin.length > 0} desktop={desktop} entering={entering} onStartRoom={onStartRoom} onStartGroup={onStartGroup} />
  );
  const join = <GroupsToJoin groups={toJoin} />;

  if (!desktop)
    return (
      <div className="flex flex-col gap-8">
        {live}
        <div className="flex flex-col gap-4">
          {book}
          {daily}
        </div>
        {groups}
        {forYou}
        {join}
      </div>
    );

  const side = !!view.passage || view.forYou.length > 0;
  const joinInPanel = toJoin.length > 0 && side;
  return (
    <div className="flex flex-col gap-8 pb-4">
      {live}
      <div className="grid grid-cols-2 gap-10">
        {book}
        {daily}
      </div>
      {/* Study groups a little wider than Reading now above it (the side
          column takes the rest). */}
      <div className={`grid items-start gap-10 ${side || toJoin.length > 0 ? "grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]" : "grid-cols-[minmax(0,720px)]"}`}>
        <div className="flex min-w-0 flex-col gap-5 rounded-sm border border-[var(--color-app-border)] bg-[var(--reader-bg)] px-4 pt-4 pb-5">
          {groups}
          {joinInPanel && (
            <>
              <div className="-mx-6 h-px bg-[var(--color-app-border)]" />
              {join}
            </>
          )}
        </div>
        {(side || toJoin.length > 0) && (
          <div className="flex min-w-0 flex-col gap-8">
            {view.passage && <PassageCard passage={view.passage} />}
            {forYou}
            {!joinInPanel && join}
          </div>
        )}
      </div>
    </div>
  );
}

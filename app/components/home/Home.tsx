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
 *   GroupsToJoin — public groups you can join
 *   PassageCard  — the passage of the day
 * Mobile: one column, your groups before For you. Desktop: the book beside
 * today's reading; then the passage, with a narrow panel of your groups over
 * groups to join beside it; then For you. No view yet: a spinner, or a line when it failed.
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
          <p className="text-ui-body text-[var(--color-app-text-secondary)]">
            Home didn’t load. Try again in a moment.
          </p>
        ) : (
          <div
            role="status"
            aria-label="Loading"
            className="size-7 animate-spin rounded-full border-[2.5px] border-sand-200 border-t-brand-500"
          />
        )}
      </div>
    );

  const joined = view.groups.filter((g) => g.joined);
  const toJoin = view.groups.filter((g) => !g.joined);
  const live = view.strip.length > 0 && (
    <StatusStrip
      items={view.strip}
      onPick={onPickRoom}
      disabled={entering}
      className="pb-1"
    />
  );
  const book = (
    <BookCard current={view.current} start={view.start} desktop={desktop} />
  );
  const daily = (
    <DailyCard
      streak={view.streak}
      today={view.today}
      desktop={desktop}
      onSaveGoal={onSaveGoal}
    />
  );
  const forYou = <ForYou books={view.forYou} desktop={desktop} />;
  const groups = (
    <StudyGroups
      groups={joined}
      rooms={view.rooms}
      joinable={toJoin.length > 0}
      desktop={desktop}
      entering={entering}
      onStartRoom={onStartRoom}
      onStartGroup={onStartGroup}
    />
  );
  const join = <GroupsToJoin groups={toJoin} />;

  const passage = view.passage && <PassageCard passage={view.passage} />;

  if (!desktop)
    return (
      <div className="flex flex-col gap-8">
        {live}
        <div className="flex flex-col gap-3">
          {book}
          {daily}
          {passage}
        </div>
        {groups}
        {forYou}
        {join}
      </div>
    );

  // Desktop: the two cards side by side; then the passage, Study groups
  // (the groups to join in its panel) and For you, each on its own row.
  return (
    <div className="flex flex-col gap-8 pb-4">
      {live}
      <div className="grid grid-cols-2 gap-6">
        {book}
        {daily}
      </div>
      {passage}
      <StudyGroups
        groups={joined}
        rooms={view.rooms}
        joinable={toJoin.length > 0}
        desktop
        entering={entering}
        onStartRoom={onStartRoom}
        onStartGroup={onStartGroup}
        boxed
      >
        {toJoin.length > 0 && (
          <>
            <div className="-mx-4 h-px bg-[var(--color-app-border)]" />
            {join}
          </>
        )}
      </StudyGroups>
      {forYou}
    </div>
  );
}

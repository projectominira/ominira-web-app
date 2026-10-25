"use client";

import type { HomeView, StatusItem } from "@/lib/rooms/types";
import Community from "./Community";
import FeaturedBooks from "./FeaturedBooks";
import GroupsToJoin from "./GroupsToJoin";
import PassageCard from "./PassageCard";
import StatusStrip from "./StatusStrip";
import TodayCard from "./TodayCard";

/**
 * Home (home-spec §2 Home), laid out from its sections:
 *   StatusStrip   — the rooms live now
 *   FeaturedBooks — the featured covers
 *   TodayCard     — the book you're reading and today's reading (+ PassageCard on desktop)
 *   Community     — the chat list of groups and book rooms
 *   GroupsToJoin  — public groups to join, in the right rail
 * Desktop: Featured, then Community (holding the live rooms) beside Today.
 * Mobile: the live rooms on top like stories, then Featured, Today, Community.
 * No view yet: a spinner, or a line when it failed.
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
  signedIn = false,
}: {
  view: HomeView | undefined;
  failed?: boolean;
  desktop?: boolean;
  /** Joining or starting a room: the strip waits. */
  entering?: boolean;
  onSaveGoal?: (goal: number) => void;
  onPickRoom?: (item: StatusItem) => void;
  /** "Start a reading room"; none signed out. */
  onStartRoom?: () => void;
  /** "Start a study group"; none signed out. */
  onStartGroup?: () => void;
  signedIn?: boolean;
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

  const live =
    view.strip.length > 0 ? (
      <StatusStrip items={view.strip} onPick={onPickRoom ?? (() => {})} disabled={entering} className={desktop ? "mb-5" : "pt-1 pb-1"} />
    ) : null;
  return (
    <div className="flex flex-col gap-14 shell:gap-10 shell:pb-4">
      {!desktop && live}
      {view.featured.length > 0 && <FeaturedBooks rows={view.featured} />}
      <div className="grid grid-cols-1 gap-14 shell:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] shell:gap-x-12">
        <div className="flex flex-col gap-14 shell:col-start-2 shell:row-start-1 shell:gap-6">
          <TodayCard current={view.current} start={view.featured[0]?.material ?? null} streak={view.streak} today={view.today} desktop={desktop} onSaveGoal={onSaveGoal} />
          {desktop && view.passage && <PassageCard passage={view.passage} />}
          {signedIn && <GroupsToJoin groups={view.groups.filter((g) => !g.joined)} />}
        </div>
        <Community
          className="shell:col-start-1 shell:row-start-1"
          groups={view.groups}
          rooms={view.rooms}
          live={desktop ? live : null}
          signedIn={signedIn}
          desktop={desktop}
          entering={entering}
          onStartRoom={onStartRoom}
          onStartGroup={onStartGroup}
        />
      </div>
    </div>
  );
}

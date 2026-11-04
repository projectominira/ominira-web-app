"use client";

import { Mic, Users } from "lucide-react";
import { byLatest } from "@/lib/rooms/home";
import type { GroupCardView, RoomRowView } from "@/lib/rooms/types";
import BookRoomRow from "./BookRoomRow";
import GroupRow from "./GroupRow";
import NewMenu, { type NewAction } from "./NewMenu";

export const SECTION_TITLE = "m-0 text-ui-md font-bold text-[var(--reader-text)]";
/** A row's text action (Join, Start one): brand, no frame. */
export const ROW_ACTION =
  "-mr-3 flex-none cursor-pointer rounded-sm border-0 bg-transparent px-3 py-2 text-ui-sm font-semibold text-[var(--color-app-brand)] transition-colors hover:bg-[color-mix(in_srgb,var(--reader-accent)_10%,transparent)] disabled:opacity-60";

/**
 * Study groups: the heading with its ＋ (NewMenu: a study group or a reading
 * room), then the groups you're in, the latest first (and the book rooms,
 * while they're shown — lib/config/features). In none, a row like a group's
 * with the way to start one, pointing at the groups you can join.
 */
export default function StudyGroups({
  groups,
  rooms,
  joinable,
  entering,
  desktop,
  onStartRoom,
  onStartGroup,
}: {
  /** Your groups (joined). */
  groups: GroupCardView[];
  rooms: RoomRowView[];
  /** Groups to join are shown with it. */
  joinable: boolean;
  entering: boolean;
  desktop: boolean;
  onStartRoom: () => void;
  onStartGroup: () => void;
}) {
  const actions: NewAction[] = [
    { label: "Start a study group", icon: <Users size={18} />, onClick: onStartGroup },
    { label: "Start a reading room", icon: <Mic size={18} />, onClick: onStartRoom },
  ];
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <h2 className={SECTION_TITLE}>Study groups</h2>
        <NewMenu desktop={desktop} disabled={entering} actions={actions} />
      </div>
      {groups.length || rooms.length ? (
        <div className="flex flex-col divide-y divide-[var(--color-app-border)]">
          {byLatest(groups).map((g) => (
            <GroupRow key={`g:${g.slug}`} group={g} />
          ))}
          {rooms.map((r) => (
            <BookRoomRow key={`b:${r.slug}`} room={r} />
          ))}
        </div>
      ) : (
        // None yet: a row like a group's, a dashed mark where its letter goes.
        <div className="flex items-center gap-3 py-2.5">
          <span className="flex size-11 flex-none items-center justify-center rounded-full border border-dashed border-[var(--reader-border)] text-[var(--reader-text-muted)]">
            <Users size={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[13px] font-bold text-[var(--color-app-text)]">No study group yet</span>
            <span className="text-ui-sm text-[var(--reader-text-muted)]">{joinable ? "Join one below, or start your own." : "Start one and read books with others."}</span>
          </span>
          <button type="button" onClick={onStartGroup} disabled={entering} className={ROW_ACTION}>
            Start one
          </button>
        </div>
      )}
    </section>
  );
}

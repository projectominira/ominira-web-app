"use client";

import { Mic, Users } from "lucide-react";
import { byLatest } from "@/lib/rooms/home";
import type { GroupCardView, RoomRowView } from "@/lib/rooms/types";
import { SWITCH } from "@/app/components/rooms/RoomHeader";
import BookRoomRow from "./BookRoomRow";
import GroupRow from "./GroupRow";
import NewMenu, { type NewAction } from "./NewMenu";

export const SECTION_TITLE = "m-0 text-ui-md font-bold text-[var(--reader-text)]";

/**
 * Study groups: the heading with its ＋ (NewMenu: a study group or a reading
 * room), then the groups you're in, the latest first (and the book rooms,
 * while they're shown — lib/config/features). In none, a line and the way
 * to start one, pointing at the groups to join when there are some.
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
        <div className="flex flex-col items-start gap-3 rounded-sm border border-dashed border-[var(--reader-border)] p-5">
          <div className="flex flex-col gap-1">
            <p className="m-0 text-ui-md text-[var(--reader-text)]">You’re not in a study group yet.</p>
            <p className="m-0 text-ui-body-regular text-[var(--color-app-text-secondary)]">
              {joinable ? "Join one of the groups below, or start your own and invite comrades." : "Start one and invite comrades to read a book with you."}
            </p>
          </div>
          <button type="button" onClick={onStartGroup} disabled={entering} className={`${SWITCH} px-4 py-2 text-ui-sm font-semibold disabled:opacity-60`}>
            Start a study group
          </button>
        </div>
      )}
    </section>
  );
}

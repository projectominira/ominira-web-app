"use client";

import { useState, type ReactNode } from "react";
import { Mic, Users } from "lucide-react";
import { byLatest } from "@/lib/rooms/home";
import type { GroupCardView, RoomRowView } from "@/lib/rooms/types";
import BookRoomRow from "./BookRoomRow";
import ChatTabs, { shown, type ChatFilter } from "./ChatTabs";
import GroupRow from "./GroupRow";
import NewMenu, { type NewAction } from "./NewMenu";

/**
 * Community: every place comrades read and talk together. The heading with
 * its ＋ (NewMenu), the live rooms (desktop only; mobile shows them at the
 * top of Home), the filter tabs, one chat list — your study groups, then
 * the book rooms, each the latest first. Signed out, public groups are
 * plain rows in the list; the groups to join are Home's right rail.
 * Nothing when there's nothing to show or start.
 */
export default function Community({
  groups,
  rooms,
  live,
  signedIn,
  desktop,
  entering,
  onStartRoom,
  onStartGroup,
  className = "",
}: {
  groups: GroupCardView[];
  rooms: RoomRowView[];
  /** The live rooms, shown under the heading. */
  live?: ReactNode;
  signedIn: boolean;
  desktop: boolean;
  entering: boolean;
  onStartRoom?: () => void;
  onStartGroup?: () => void;
  className?: string;
}) {
  const [filter, setFilter] = useState<ChatFilter>("all");
  const joined = signedIn ? groups.filter((g) => g.joined) : groups;
  const actions: NewAction[] = [];
  if (onStartRoom) actions.push({ label: "Start a reading room", sub: "Read a book aloud, live, with comrades", icon: <Mic size={19} />, onClick: onStartRoom });
  if (onStartGroup) actions.push({ label: "Start a study group", sub: "Read a book together, on a schedule", icon: <Users size={19} />, onClick: onStartGroup });

  if (!live && !joined.length && !rooms.length && !actions.length) return null;
  return (
    <section className={`flex min-w-0 flex-col self-start ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="m-0 font-serif type-3 text-[var(--reader-text)]">Community feed</h2>
        <NewMenu desktop={desktop} disabled={entering} actions={actions} />
      </div>
      {live}
      <ChatTabs groups={joined} rooms={rooms} value={filter} onChange={setFilter} />
      {(joined.length > 0 || rooms.length > 0) && (
        <div className="flex flex-col divide-y divide-[var(--reader-border)]">
          {byLatest(shown(joined, "groups", filter)).map((g) => (
            <GroupRow key={`g:${g.slug}`} group={g} />
          ))}
          {shown(rooms, "books", filter).map((r) => (
            <BookRoomRow key={`b:${r.slug}`} room={r} />
          ))}
        </div>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import ShareButton from "@/app/components/materials/ShareButton";
import GroupInfo, { INFO_TILE, TeamBlock } from "@/app/components/rooms/GroupInfo";
import InviteMenu from "./InviteMenu";
import { ScreenPage } from "@/app/components/rooms/RoomScreen";
import { useChapterEnds, useGroupBooks, useGroupMembers } from "@/lib/groups/hooks";
import type { GroupPage, SessionsView, TargetView } from "@/lib/groups/types";
import { chapterAt, targetRange } from "@/lib/rooms/cards";
import { memberRows, readingList, schedule } from "@/lib/rooms/info";
import type { RoomSession, RoomTarget } from "@/lib/rooms/types";
import { formatInstant } from "@/lib/time/format";
import { groupHref } from "@/lib/groups/copy";
import { useRouter } from "next/navigation";

/** Members listed before "See all". */
const MEMBERS_SHOWN = 6;

/**
 * Group info, the group page's About tab (rooms-spec §2, 4d): loads what only
 * it shows (the members, the book's chapters) and hands the room's views to
 * the sheet's parts. The team block and the
 * reading list's Edit are the moderators'.
 */
export default function GroupInfoPanel({
  slug,
  page,
  target,
  sessions,
  roomTarget,
  roomSession,
  viewerId,
  onRemind,
  onSetTarget,
  onSchedule,
  onStartRoom,
}: {
  slug: string;
  page: GroupPage;
  target: TargetView | undefined;
  sessions: SessionsView | undefined;
  roomTarget: RoomTarget | null;
  roomSession: RoomSession | null;
  viewerId: string | null;
  onRemind?: () => void;
  onSetTarget: () => void;
  onSchedule: () => void;
  onStartRoom: () => void;
}) {
  const router = useRouter();
  const { group, myRole } = page;
  const team = myRole === "moderator";
  const [all, setAll] = useState(false);
  const { data: books = [] } = useGroupBooks(slug);
  const { data: members = [] } = useGroupMembers(slug);
  const { data: ends = [] } = useChapterEnds(target?.currentMaterialId ?? null);

  const groupAt = target?.groupPct != null ? chapterAt(ends, target.groupPct) : null;
  const rows = memberRows(members, { viewerId });
  const upcoming = sessions?.upcoming[0];
  const nextLine = upcoming ? `${formatInstant(upcoming.startsAt, "day")}, ${formatInstant(upcoming.startsAt, "time")}` : null;

  return (
    <ScreenPage>
      <GroupInfo
        name={group.name}
        members={group.memberCount}
        about={group.description || null}
        invite={
          team ? (
            <InviteMenu slug={slug} name={group.name} />
          ) : (
            <ShareButton title={group.name} text={`Read with ${group.name} on Ominira`} ariaLabel="Share a link to this group" label="Invite" className={INFO_TILE} iconSize={20} />
          )
        }
        team={
          team && (
            <TeamBlock
              target={roomTarget ? `${targetRange(roomTarget)} · ${roomTarget.view.onTrack} of ${roomTarget.view.memberCount} on track` : null}
              next={nextLine}
              onTarget={onSetTarget}
              onSchedule={onSchedule}
              onStart={onStartRoom}
            />
          )
        }
        list={readingList(books, { groupAt, mine: target?.mine?.pct ?? null })}
        canEditList={team}
        onEditList={() => router.push(`${groupHref(slug)}/reading-list`)}
        schedule={sessions ? schedule(sessions, roomSession) : { next: null, later: [], past: [] }}
        reminded={!!upcoming?.remind}
        onRemind={onRemind}
        people={all ? rows : rows.slice(0, MEMBERS_SHOWN)}
        allPeople={all || rows.length <= MEMBERS_SHOWN}
        onAllPeople={() => setAll(true)}
      />
    </ScreenPage>
  );
}

"use client";

import type { ReactNode } from "react";
import { Bell, BellOff } from "lucide-react";
import CalendarLeaf from "@/app/components/shared/CalendarLeaf";
import { scheduleLine } from "@/lib/rooms/cards";
import { personName } from "@/lib/rooms/names";
import type { MemberRow as Member, ReadingListRow, RoomSession } from "@/lib/rooms/types";
import CoverStatus from "@/app/components/groups/CoverStatus";
import ReadingProgress from "@/app/components/shared/ReadingProgress";
import { button } from "./buttons";
import RoomAvatar, { GroupAvatar } from "./RoomAvatar";

// Group info (rooms-spec §2, sheet #c8), the group page's About tab: the
// header and its Invite, the team's block, the reading list as a syllabus,
// the schedule and members. Only moderators set the reading list.

const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;
const EYEBROW = "text-ui-xs tracking-eyebrow text-[var(--color-app-text-muted)] uppercase";

/** The Invite tile: one look for the dropdown (moderators) and the share button (everyone). */
export const INFO_TILE =
  "flex min-h-9 px-5 cursor-pointer items-center justify-center gap-2 rounded-sm border border-[var(--color-app-border)] bg-[var(--color-app-surface)] text-ui-caption font-bold text-[var(--color-app-text)]";

export function GroupInfoHeader({ name, people, about, invite, menu }: { name: string; people: string; about: string | null; invite: ReactNode; menu?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3.5 text-center text-[var(--color-app-text)]">
      <GroupAvatar name={name} size={72} fontSize={24} />
      <div className="flex flex-col gap-1">
        <span className="font-serif text-[20px] font-bold">{name}</span>
        {people && <span className="text-ui-caption text-pretty text-[var(--color-app-text-secondary)]">{people}</span>}
      </div>
      {about && <p className="m-0 text-ui-sm text-pretty text-[var(--color-app-text-secondary)]">{about}</p>}
      <div className="flex items-center justify-center gap-1">
        {invite}
        {menu}
      </div>
    </div>
  );
}

/** One list in reading order, each book's status on its cover; the book
 * read now carries your progress. */
export function ReadingList({ list, team = false, onEdit }: { list: ReadingListRow[]; team?: boolean; onEdit?: () => void }) {
  return (
    <div className="flex flex-col gap-3 text-[var(--color-app-text)]">
      <div className="flex items-center gap-2">
        <span className={`flex-1 ${EYEBROW}`}>Reading list</span>
        {team ? (
          <button type="button" onClick={onEdit} className="min-h-9 cursor-pointer px-1 font-sans text-[13px] font-bold text-[var(--reader-text-muted)]">
            Edit
          </button>
        ) : (
          <span className="text-ui-caption text-[var(--color-app-text-muted)]">Set by the moderators</span>
        )}
      </div>
      {list.map((row) => (
        <div key={row.id} className="flex items-center gap-3">
          <span className="relative h-16 w-12 flex-none overflow-hidden rounded-2xs bg-oxblood-500">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {row.cover && <img src={row.cover} alt="" className="h-full w-full object-cover" />}
            <CoverStatus status={row.status} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate font-serif text-[14px] font-semibold">{row.title}</span>
            <span className="text-ui-caption capitalize text-[var(--color-app-text-secondary)]">{row.sub}</span>
            {row.status === "current" && <ReadingProgress chapter={null} pct={Math.round(row.pct ?? 0)} />}
            {row.status === "done" && <ReadingProgress chapter={null} pct={100} />}
          </div>
        </div>
      ))}
    </div>
  );
}

/** One session in the schedule, a plain row like a book: its date leaf,
 * topic and when. The next one carries Remind me. */
export function ScheduleRow({ card, next = false, reminded = false, onRemind }: { card: RoomSession; next?: boolean; reminded?: boolean; onRemind?: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <CalendarLeaf instant={card.session.startsAt} variant="later" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-ui-sm font-bold">{card.session.topic}</span>
        <span className="text-ui-caption text-[var(--color-app-text-secondary)]">{scheduleLine(card, next ? "next" : card.state === "ended" ? "past" : "later")}</span>
      </div>
      {next && onRemind && (
        // A bell toggle, so the topic keeps the row's width.
        <button
          type="button"
          aria-pressed={reminded}
          aria-label={reminded ? "Reminder on, an hour before" : "Remind me an hour before"}
          onClick={onRemind}
          className={`flex size-9 flex-none cursor-pointer items-center justify-center rounded-sm hover:bg-[var(--color-app-surface-muted)] ${
            reminded ? "text-[var(--color-app-brand)]" : "text-[var(--color-app-text-muted)]"
          }`}
        >
          {reminded ? <Bell size={18} strokeWidth={1.75} /> : <BellOff size={18} strokeWidth={1.75} />}
        </button>
      )}
    </div>
  );
}

export function MemberRow({ member }: { member: Member }) {
  const { comrade, role } = member;
  return (
    <div className="flex min-h-13 items-center gap-3">
      <RoomAvatar comrade={comrade} size={36} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-ui-sm font-bold">{personName(comrade.pseudonym)}</span>
          {role && <span className="rounded-xs bg-[var(--color-app-chip)] px-1.5 py-px font-sans text-[10px]/[1.4] font-bold text-[var(--color-app-text-secondary)]">{role}</span>}
        </div>
        {member.pct !== undefined &&
          (member.pct === null ? (
            <span className="text-ui-caption text-[var(--color-app-text-muted)]">Not started</span>
          ) : (
            <ReadingProgress chapter={null} pct={Math.round(member.pct)} />
          ))}
      </div>
    </div>
  );
}

/** Group info: the header with its Invite and ⋮, the reading list, the
 * schedule and the members, one column; the tab scrolls it. */
export default function GroupInfo({
  name,
  people,
  about,
  invite,
  menu,
  list,
  canEditList = false,
  onEditList,
  schedule,
  reminded = false,
  onRemind,
  members,
  memberCount,
  allMembers = false,
  onAllMembers,
}: {
  name: string;
  /** The comrades, as the room's head names them. */
  people: string;
  about: string | null;
  /** The Invite tile (INFO_TILE). */
  invite: ReactNode;
  /** The moderators' ⋮; null for everyone else. */
  menu?: ReactNode;
  list: ReadingListRow[];
  canEditList?: boolean;
  onEditList?: () => void;
  schedule: { next: RoomSession | null; later: RoomSession[]; past: RoomSession[] };
  reminded?: boolean;
  onRemind?: () => void;
  members: Member[];
  memberCount: number;
  /** Every member is listed: no "See all". */
  allMembers?: boolean;
  onAllMembers?: () => void;
}) {
  const { next, later, past } = schedule;
  const rest = [...later, ...past];
  return (
    <div className="flex flex-col gap-8">
      <GroupInfoHeader name={name} people={people} about={about} invite={invite} menu={menu} />
      <ReadingList list={list} team={canEditList} onEdit={onEditList} />
      {(next || rest.length > 0) && (
        <div className="flex flex-col gap-3 text-[var(--color-app-text)]">
          <span className={EYEBROW}>Sessions</span>
          {next && <ScheduleRow card={next} next reminded={reminded} onRemind={onRemind} />}
          {rest.map((card) => (
            <ScheduleRow key={card.session.id} card={card} />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-0.5 text-[var(--color-app-text)]">
        <span className={`pb-1.5 ${EYEBROW}`}>Members · {memberCount}</span>
        {members.map((m) => (
          <MemberRow key={m.comrade.readerId} member={m} />
        ))}
        {!allMembers && (
          <button type="button" onClick={onAllMembers} className={button("ghost", { full: true })}>
            See all {memberCount} members
          </button>
        )}
      </div>
    </div>
  );
}

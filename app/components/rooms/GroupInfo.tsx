"use client";

import type { ReactNode } from "react";
import { Calendar, ChevronRight, Mic, Target } from "lucide-react";
import CalendarLeaf from "@/app/components/shared/CalendarLeaf";
import { comradeCount } from "@/lib/groups/copy";
import { scheduleLine } from "@/lib/rooms/cards";
import { personName } from "@/lib/rooms/names";
import type { MemberRow as Member, ReadingList as List, ReadingListRow, RoomSession } from "@/lib/rooms/types";
import { button } from "./buttons";
import RoomAvatar, { GroupAvatar } from "./RoomAvatar";

// Group info (rooms-spec §2, sheet #c8), the group page's About tab: the
// header and its Invite, the team's block, the reading list as a syllabus,
// the schedule and members. Only moderators set the reading list.

const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;
const EYEBROW = "text-ui-xs tracking-eyebrow text-[var(--color-app-text-muted)] uppercase";
const STEP = "text-ui-caption font-bold";

/** The Invite tile: one look for the dropdown (moderators) and the share button (everyone). */
export const INFO_TILE =
  "flex min-h-10 mx-auto px-4 cursor-pointer items-center justify-center gap-2 rounded-sm border border-[var(--color-app-border)] bg-[var(--color-app-surface)] text-ui-caption font-bold text-[var(--color-app-text)]";

export function GroupInfoHeader({ name, members, about, invite }: { name: string; members: number; about: string | null; invite: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3.5 text-center text-[var(--color-app-text)]">
      <GroupAvatar name={name} size={72} fontSize={24} />
      <div className="flex flex-col gap-1">
        <span className="font-serif text-[20px] font-bold">{name}</span>
        <span className="text-ui-caption text-[var(--color-app-text-secondary)]">{comradeCount(members)}</span>
      </div>
      {about && <p className="m-0 text-ui-sm text-pretty text-[var(--color-app-text-secondary)]">{about}</p>}
      <div className="w-full">{invite}</div>
    </div>
  );
}

/** The moderators' block (5d): only the team sees it. */
export function TeamBlock({ target, next, onTarget, onSchedule, onStart }: { target: string | null; next: string | null; onTarget?: () => void; onSchedule?: () => void; onStart?: () => void }) {
  const row = "flex min-h-13 cursor-pointer items-center gap-3 rounded-md px-3 text-left";
  const action = "font-sans text-[12px]/none font-bold text-brand-200";
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-sand-900 p-3.5 text-sand-25">
      <div className="flex items-center justify-between px-0.5 pb-1">
        <span className="font-sans text-[11px]/[1.3] font-bold tracking-eyebrow text-brand-200 uppercase">Run the group</span>
        {/* <span className="text-ui-caption text-sand-25/68">Only the team sees this</span> */}
      </div>
      <button type="button" onClick={onTarget} className={`${row} border border-white/16`}>
        <Target {...ICON} className="flex-none" />
        <span className="flex flex-1 flex-col gap-px">
          <span className="text-ui-sm font-bold">This week’s target</span>
          <span className="text-ui-caption text-sand-25/68">{target ?? "None set"}</span>
        </span>
        <span className={action}>{target ? "Edit" : "Set"}</span>
      </button>
      <button type="button" onClick={onSchedule} className={`${row} border border-white/16`}>
        <Calendar {...ICON} className="flex-none" />
        <span className="flex flex-1 flex-col gap-px">
          <span className="text-ui-sm font-bold">Schedule a reading room</span>
          {next && <span className="text-ui-caption text-sand-25/68">Next: {next}</span>}
        </span>
        <span className={action}>New</span>
      </button>
      <button type="button" onClick={onStart} className={`${row} bg-brand-500`}>
        <Mic {...ICON} className="flex-none" />
        <span className="flex-1 text-ui-sm font-bold">Start a reading room now</span>
      </button>
    </div>
  );
}

function Cover({ row, big }: { row: ReadingListRow; big?: boolean }) {
  const size = "h-16 w-13";
  if (!row.cover) return <span className={`${size} flex-none rounded-2xs bg-oxblood-500`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={row.cover} alt="" className={`${size} flex-none rounded-2xs object-cover`} />;
}

function Book({ row }: { row: ReadingListRow }) {
  return (
    <div className="flex items-center gap-3">
      <Cover row={row} />
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate font-serif text-[14px] font-semibold">{row.title}</span>
        <span className="text-ui-caption capitalize text-[var(--color-app-text-secondary)]">{row.sub}</span>
      </div>
    </div>
  );
}

export function ReadingList({ list, team = false, onEdit }: { list: List; team?: boolean; onEdit?: () => void }) {
  const { now, next, finished } = list;
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
      {now && (
        <>
          <span className={`${STEP} text-[var(--color-app-brand)]`}>Reading now</span>
          <div className="flex items-center gap-3">
            <Cover row={now} big />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-serif text-[14px] truncate font-semibold">{now.title}</span>
              <span className="text-ui-caption text-[var(--color-app-text-secondary)]">{now.sub}</span>
              <div className="h-1 overflow-hidden rounded-full bg-sand-100 mt-1">
                <div style={{ width: `${now.pct ?? 0}%` }} className="h-full bg-brand-500" />
              </div>
            </div>
          </div>
        </>
      )}
      {next.length > 0 && <span className={`${STEP} pt-1 text-[var(--color-app-text-secondary)]`}>Up Next</span>}
      {next.map((row) => (
        <Book key={row.id} row={row} />
      ))}
      {finished.length > 0 && <span className={`${STEP} pt-1 text-[var(--color-app-text-secondary)]`}>Finished</span>}
      {finished.map((row) => (
        <Book key={row.id} row={row} />
      ))}
    </div>
  );
}

/** One session in the schedule: the next as a card with Remind me, later
 * ones plain, past ones opening their summary (`onOpen`). */
export function ScheduleRow({ card, row, reminded = false, onRemind, onOpen }: { card: RoomSession; row: "next" | "later" | "past"; reminded?: boolean; onRemind?: () => void; onOpen?: () => void }) {
  const text = (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-ui-sm font-bold">{card.session.topic}</span>
      <span className="text-ui-caption text-[var(--color-app-text-secondary)]">{scheduleLine(card, row)}</span>
    </div>
  );
  if (row === "next") {
    return (
      <div className="flex items-center gap-3 rounded-sm border border-[var(--color-app-border)] bg-[var(--color-app-surface)] p-3">
        <CalendarLeaf instant={card.session.startsAt} variant="next" />
        {text}
        <button
          type="button"
          aria-pressed={reminded}
          onClick={onRemind}
          className={`min-h-11 flex-none cursor-pointer rounded-md border border-brand-500 px-3 font-sans text-[13px]/none font-bold ${
            reminded ? "bg-brand-500 text-sand-25" : "text-[var(--color-app-brand)]"
          }`}
        >
          {reminded ? "Reminder set" : "Remind me"}
        </button>
      </div>
    );
  }
  // A past row opens its summary; without one to open it's a plain row.
  if (row === "later" || !onOpen) {
    return (
      <div className={`flex items-center gap-3 ${row === "past" ? "min-h-14" : ""}`}>
        <CalendarLeaf instant={card.session.startsAt} variant="later" />
        {text}
      </div>
    );
  }
  return (
    <button type="button" onClick={onOpen} className="flex min-h-14 cursor-pointer items-center gap-3 text-left">
      <CalendarLeaf instant={card.session.startsAt} variant="later" />
      {text}
      <ChevronRight size={16} strokeWidth={1.75} aria-hidden className="text-[var(--color-app-text-muted)]" />
    </button>
  );
}

export function MemberRow({ member }: { member: Member }) {
  const { comrade, role } = member;
  return (
    <div className="flex min-h-13 items-center gap-3">
      <RoomAvatar comrade={comrade} size={36} />
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="text-ui-sm font-bold">{personName(comrade.pseudonym)}</span>
        {role && <span className="rounded-xs bg-sand-100 px-1.5 py-px font-sans text-[10px]/[1.4] font-bold text-[var(--color-app-text-secondary)]">{role}</span>}
      </div>
    </div>
  );
}

/** Group info: the header and its Invite, the team's block, the reading
 * list, the schedule and the members, one column; the tab scrolls it. */
export default function GroupInfo({
  name,
  members,
  about,
  invite,
  team = null,
  list,
  canEditList = false,
  onEditList,
  schedule,
  reminded = false,
  onRemind,
  people,
  allPeople = false,
  onAllPeople,
}: {
  name: string;
  members: number;
  about: string | null;
  /** The Invite tile (INFO_TILE). */
  invite: ReactNode;
  /** The moderators' block; null for everyone else. */
  team?: ReactNode;
  list: List;
  canEditList?: boolean;
  onEditList?: () => void;
  schedule: { next: RoomSession | null; later: RoomSession[]; past: RoomSession[] };
  reminded?: boolean;
  onRemind?: () => void;
  people: Member[];
  /** Every member is listed: no "See all". */
  allPeople?: boolean;
  onAllPeople?: () => void;
}) {
  const { next, later, past } = schedule;
  return (
    <div className="flex flex-col gap-8">
      <GroupInfoHeader name={name} members={members} about={about} invite={invite} />
      {team}
      <ReadingList list={list} team={canEditList} onEdit={onEditList} />
      {(next || later.length > 0 || past.length > 0) && (
        <div className="flex flex-col gap-2.5 text-[var(--color-app-text)]">
          <span className={EYEBROW}>Schedule</span>
          {next && <ScheduleRow card={next} row="next" reminded={reminded} onRemind={onRemind} />}
          {later.map((card) => (
            <ScheduleRow key={card.session.id} card={card} row="later" />
          ))}
          {past.length > 0 && <span className={`${STEP} pt-1.5 text-[var(--color-app-text-secondary)]`}>Past</span>}
          {past.map((card) => (
            <ScheduleRow key={card.session.id} card={card} row="past" />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-0.5 text-[var(--color-app-text)]">
        <span className={`pb-1.5 ${EYEBROW}`}>Members · {members}</span>
        {people.map((m) => (
          <MemberRow key={m.comrade.readerId} member={m} />
        ))}
        {!allPeople && (
          <button type="button" onClick={onAllPeople} className={button("ghost", { full: true })}>
            See all {members} members
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown, Headphones } from "lucide-react";
import { listNames, shortName } from "@/lib/rooms/names";
import type { RepliedNote, RoomItem } from "@/lib/rooms/types";
import RoomAvatar from "./RoomAvatar";

const ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;
const PILL = "bg-[var(--color-app-chip)] text-ui-caption text-[var(--color-app-text-secondary)]";
const WHO = "font-bold text-[var(--color-app-text)]";

type Line = Extract<RoomItem, { t: "system" } | { t: "joins" }>;

/** A group change (rooms-spec §2, sheet #c3): quiet, centred, never a
 * bubble. A reading room's line carries the headphones. Consecutive joins
 * arrive as one `joins` item and expand on tap. */
export default function SystemLine({ item, defaultOpen = false }: { item: Line; defaultOpen?: boolean }) {
  if (item.t === "joins") return <Joins item={item} defaultOpen={defaultOpen} />;
  if (item.mic) {
    return (
      <div className="flex justify-center">
        <div className={`flex max-w-[92%] items-center gap-1.5 rounded-pill-sm px-3 py-1.25 text-center text-pretty ${PILL}`}>
          <Headphones size={13} {...ICON} className="flex-none" />
          <span>
            {item.actor && <b className={WHO}>{item.actor} </b>}
            {item.text}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-center">
      <div className={`max-w-[88%] rounded-pill-sm px-3 py-1.25 text-center text-pretty ${PILL}`}>
        {item.actor && <b className={WHO}>{item.actor} </b>}
        {item.text}
        {item.em && (
          <>
            {" "}
            <i className="font-serif text-[13px] text-[var(--color-app-text)]">{item.em}</i>
          </>
        )}
        {item.post && ` ${item.post}`}
      </div>
    </div>
  );
}

function Joins({ item, defaultOpen }: { item: Extract<RoomItem, { t: "joins" }>; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const { comrades } = item;
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex max-w-[92%] min-h-11 cursor-pointer items-center gap-2 rounded-full px-1.5 py-1"
      >
        <span className={`inline-flex min-w-0 items-center gap-2 rounded-full px-1.5 py-1 ${PILL}`}>
          {!open && (
            <span className="flex flex-none">
              {comrades.slice(0, 3).map((c) => (
                <RoomAvatar key={c.readerId} comrade={c} size={20} className="-mr-1.5 border-2 border-[var(--color-app-chip)] last:mr-0" />
              ))}
            </span>
          )}
          <span className="truncate pl-1.5">
            <b className={WHO}>{comrades.length} joined</b> · {listNames(comrades.map((c) => shortName(c.pseudonym)), comrades.length)}
          </span>
          <ChevronDown size={14} {...ICON} className={`flex-none ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="flex max-w-[92%] flex-wrap justify-center gap-1">
          {comrades.map((c) => (
            <span key={c.readerId} className={`rounded-full px-2.5 py-0.75 ${PILL}`}>
              <b className={WHO}>{c.pseudonym}</b> joined
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** "Yesterday", between two hairlines. */
export function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-px flex-1 bg-[var(--color-app-border)]" />
      <span className="text-ui-xs tracking-eyebrow text-[var(--color-app-text-muted)] uppercase">{label}</span>
      <span className="h-px flex-1 bg-[var(--color-app-border)]" />
    </div>
  );
}

/** Where the viewer left off: full-bleed across the stream's 12 px gutter. */
export function UnreadDivider({ count }: { count: number }) {
  return (
    <div data-anchor="unread" className="-mx-3 flex items-center gap-2.5 bg-brand-50 px-3 py-1.75">
      <span className="h-px flex-1 bg-brand-200" />
      <span className="font-sans text-[11px]/none font-extrabold tracking-eyebrow text-brand-700 uppercase">
        {count} new message{count === 1 ? "" : "s"}
      </span>
      <span className="h-px flex-1 bg-brand-200" />
    </div>
  );
}

/** A note with comrades' replies since you last read the room, at the
 * bottom wherever the note is: "Tolu and 1 other replied to your
 * note “I read it…” · 2 new". Tapping goes to the note. */
export function RepliedLine({ replied: r, viewerId, onOpen }: { replied: RepliedNote; viewerId: string | null; onOpen: () => void }) {
  const [first, second] = r.repliers.map((c) => shortName(c.pseudonym));
  const others = r.replierCount - 1;
  const who = others === 0 ? first : others === 1 && second ? `${first} and ${second}` : `${first} and ${others} others`;
  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={onOpen}
        className={`flex max-w-[92%] cursor-pointer items-center gap-2 rounded-pill-sm px-1.5 py-1 text-left hover:text-[var(--color-app-text)] ${PILL}`}
      >
        <span className="flex flex-none">
          {r.repliers.map((c) => (
            <RoomAvatar key={c.readerId} comrade={c} size={20} className="-mr-1.5 border-2 border-[var(--color-app-chip)] last:mr-0" />
          ))}
        </span>
        <span className="min-w-0 truncate">
          <b className={WHO}>{who}</b> replied to {r.author.readerId === viewerId ? "your note" : `${shortName(r.author.pseudonym)}’s note`}
          {r.text && ` “${r.text}”`}
        </span>
        <span className="flex-none pr-1.5 font-bold text-[var(--color-app-brand)]">{r.count} new</span>
      </button>
    </div>
  );
}

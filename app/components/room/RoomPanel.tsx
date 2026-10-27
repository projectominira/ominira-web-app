"use client";

import type { ReactNode } from "react";
import { ChevronRight, Mic, MicOff } from "lucide-react";
import RoomAvatar from "./RoomAvatar";
import { formatShortTimeAgo } from "@/lib/time/relative";
import { positionLabel } from "@/lib/room/follow";
import { narratorName, roleOf } from "@/lib/room/presence";
import { useFollowing, useHands, useListening, usePlace, useReaderView, useRoom, useSpeaking, useVoice } from "@/lib/room/hooks";
import type { RoomPresence } from "@/lib/room/events";
import { useNow } from "@/lib/time/useNow";
import { useRoomStore } from "@/stores/room-store";

// The room panel's bodies (RoomMiniPlayer): the stage, everyone by face in
// a grid (hosts, then speakers, hands raised and listeners), each with
// their role under their name, as a Space shows it; and the guest list
// it opens, the same people under Host, Speakers, Hands raised and
// Listeners, each row with where they are and Read along (spec §1.6).

/** Faces on the stage before "N other listeners". */
const STAGE_FACES = 16;

/** Everyone, in the stage's order: hosts first, then speakers, hands
 * raised and listeners. */
function useEveryone() {
  const speaking = useSpeaking() ?? [];
  const hands = useHands() ?? [];
  const listening = useListening() ?? [];
  const all = [...speaking, ...hands, ...listening];
  return { all: [...all.filter((p) => p.isModerator), ...all.filter((p) => !p.isModerator)], speaking, hands, listening };
}

/** Reading along with someone (never yourself), from their card or row. */
function useFollowTarget() {
  const session = useRoomStore((s) => s.session);
  const me = useRoom((s) => s.readerId);
  const followingId = useFollowing()?.member.readerId;
  return (p: RoomPresence) => ({
    pressed: p.readerId === followingId,
    readAlong: p.readerId === me || !session ? undefined : () => session.follow(p.readerId),
  });
}

/** Who's here, by face, then the way to the rest. */
export function RoomStage({ onGuests }: { onGuests: () => void }) {
  const { all } = useEveryone();
  const follow = useFollowTarget();
  const shown = all.slice(0, STAGE_FACES);
  const others = all.length - shown.length;
  return (
    <div className="flex flex-col gap-4 pt-1 pb-4">
      <ul className="m-0 grid list-none grid-cols-4 gap-x-2 gap-y-4 p-0">
        {shown.map((p) => (
          <li key={p.readerId}>
            <Face member={p} {...follow(p)} />
          </li>
        ))}
      </ul>
      {others > 0 && (
        <button
          type="button"
          onClick={onGuests}
          className="flex cursor-pointer items-center justify-between rounded-sm border border-[var(--reader-border)] bg-transparent px-4 py-3 text-[13px] font-bold text-[var(--reader-text)] transition-colors hover:bg-[var(--reader-surface-hover)]"
        >
          {others} other {others === 1 ? "listener" : "listeners"}
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

/** Someone on the stage: their face (a tap opens their card), their name, and
 * their role, with their mic's state for a host or speaker. */
function Face({ member, pressed, readAlong }: { member: RoomPresence; pressed: boolean; readAlong: (() => void) | undefined }) {
  const { speaking } = useVoice(member.readerId);
  const micOn = member.micOnAt !== null;
  const r = roleOf(member);
  const MicIcon = micOn ? Mic : MicOff;
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
      <RoomAvatar member={member} size={52} card readAlong={readAlong} />
      <span className="flex min-w-0 max-w-full flex-col">
        <span className={`truncate text-[13px] font-bold ${pressed ? "text-[var(--reader-accent)]" : "text-[var(--reader-text)]"}`}>
          {member.name}
        </span>
        <span
          className={`flex items-center justify-center gap-1 text-xs ${
            speaking ? "font-bold text-[var(--reader-accent)]" : "font-medium text-[var(--reader-text-muted)]"
          }`}
        >
          {r !== "Listener" && <MicIcon aria-hidden="true" size={12} strokeWidth={2.25} className={micOn ? "text-[var(--reader-accent)]" : undefined} />}
          {r}
        </span>
      </span>
    </div>
  );
}

/** Everyone, under their role: the stage's "other listeners" and the
 * footer's guests button open it. */
export function RoomGuests() {
  const { speaking, hands, listening } = useEveryone();
  const follow = useFollowTarget();
  const now = useNow();
  const all = [...speaking, ...hands, ...listening];
  const hosts = all.filter((p) => p.isModerator);
  const row = (p: RoomPresence) => ({ member: p, ...follow(p) });
  const groups = [
    { title: "Speakers", people: speaking.filter((p) => !p.isModerator), fallback: "Mic on" },
    { title: "Hands raised", people: hands.filter((p) => !p.isModerator), fallback: "Hand raised" },
    { title: "Listeners", people: listening.filter((p) => !p.isModerator), fallback: "Listening" },
  ];

  return (
    <div className="flex flex-col gap-5 pt-1 pb-4">
      <Section title="Host" count={hosts.length}>
        {hosts.map((p) => (
          <Member key={p.readerId} {...row(p)} fallback={p.micOnAt !== null ? "Mic on" : "Listening"} />
        ))}
      </Section>
      {groups.map(
        (g) =>
          g.people.length > 0 && (
            <Section key={g.title} title={g.title} count={g.people.length}>
              {g.people.map((p) => (
                <Member
                  key={p.readerId}
                  {...row(p)}
                  fallback={g.fallback}
                  after={g.title === "Hands raised" && p.handRaisedAt ? formatShortTimeAgo(p.handRaisedAt, now) : undefined}
                />
              ))}
            </Section>
          )
      )}
    </div>
  );
}

/** A heading over its rows: the title and how many. */
function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 py-1">
        <h3 className="m-0 font-sans text-[15px] font-bold text-[var(--reader-text)]">{title}</h3>
        <span className="text-xs font-medium tabular-nums text-[var(--reader-text-subtle)]">{count}</span>
      </div>
      {children}
    </section>
  );
}

/** Someone in the room, the same row in every section: their face, their
 * name, and a line under it — "Speaking" while they talk, else where they
 * are ("p. 4", "Chapter 9"; spec §3.3) or `fallback`, before `after` (how
 * long a hand's been up) — then Read along. */
function Member({
  member,
  pressed,
  readAlong,
  fallback,
  after,
}: {
  member: RoomPresence;
  pressed: boolean;
  readAlong: (() => void) | undefined;
  fallback: string;
  after?: string;
}) {
  const { speaking } = useVoice(member.readerId);
  const place = usePlace(member.readerId);
  const view = useReaderView();
  const narrator = narratorName(member);
  const status = narrator
    ? `${narrator} narrating`
    : speaking
      ? "Speaking"
      : (positionLabel(member, place, view)?.text ?? fallback);
  const line = [status, after].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--reader-border)] bg-[var(--reader-surface)] py-2.5 pr-2 pl-3">
      <RoomAvatar member={member} size={40} card readAlong={readAlong} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13px] text-[var(--reader-text)] font-semibold">{member.name}</span>
        <span
          className={`truncate text-xs ${
            speaking || narrator ? "font-bold text-[var(--reader-accent)]" : "font-medium text-[var(--reader-text-muted)]"
          }`}
        >
          {line}
        </span>
      </div>
      {readAlong && (
        <button
          type="button"
          onClick={readAlong}
          aria-pressed={pressed}
          aria-label={`${pressed ? "Stop reading along with" : "Read along with"} ${member.name}`}
          className={`flex-none cursor-pointer rounded-sm px-1.5 text-xs font-bold whitespace-nowrap ${
            pressed
              ? "text-[var(--reader-accent)] hover:opacity-80"
              : "text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]"
          }`}
        >
          {pressed ? "Stop reading along" : "Read along"}
        </button>
      )}
    </div>
  );
}

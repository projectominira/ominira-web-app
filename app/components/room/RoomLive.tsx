"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, BookOpen, ScreenShare } from "lucide-react";
import InviteButton from "./InviteButton";
import FollowPill from "./FollowPill";
import RoomActions from "./RoomActions";
import { RoomChatComposer, RoomChatList } from "./RoomChat";
import { RoomGuests, RoomStage } from "./RoomPanel";
import { isIOSDevice } from "@/lib/pwa/platform";
import { useReaderView, useRoom, useRoomControls, useVoices } from "@/lib/room/hooks";
import { micBlockedHelp } from "@/lib/room/mic";
import { speakingLine } from "@/lib/room/presence";
import { useOpenRoom } from "@/lib/room/useOpenRoom";
import { formatDuration } from "@/lib/time/duration";
import { useNow } from "@/lib/time/useNow";
import { useLayoutStore } from "@/stores/layout-store";
import { useRoomStore } from "@/stores/room-store";
import { confirmAction } from "@/stores/confirm-store";
import { showToast } from "@/stores/toast-store";

// The live room, laid out as a Space: the mini-player's expanded card
// (RoomMiniPlayer). Its head: minimise (`lead`), then bring everyone to
// your page (a host, in the book) or the book (away from it), invite,
// Leave and End room (a host).
// Then the title with Live, how many and how long, and the states of spec
// §10 as a line under it. Its body is the stage (everyone by face), the
// guest list or the chat (RoomPanel, RoomChat); its foot your mic and the
// room's buttons (RoomActions), the follow pill over it in the reader.

export const headButton =
  "flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-[var(--reader-text)] transition-colors hover:bg-[var(--reader-surface-hover)]";

const IOS_NOTE_KEY = "ominira-room-ios-note";

/** The room's status line: the pill's words, and the live line's notices. */
export function useRoomStatus(): string {
  const controls = useRoomControls();
  const voices = useVoices();
  return !controls
    ? ""
    : controls.elsewhere
      ? "This room is open in another tab"
      : controls.connection === "connecting"
        ? "Connecting…"
        : controls.micState === "blocked" && !controls.micOn
          ? "Mic blocked"
          : controls.reconnecting
            ? "Reconnecting…"
            : (speakingLine(voices ?? []) ?? "Nobody's speaking");
}

/** `lead`: the head's first button on the stage; in the guests and chat
 * views it's back to the stage. */
export default function RoomLive({ lead }: { lead: ReactNode }) {
  const view = useLayoutStore((s) => s.roomPlayerView);
  const openPlayer = useLayoutStore((s) => s.openRoomPlayer);
  const room = useRoom((s) => s.room);
  const count = useRoom((s) => s.roster.length) ?? 0;
  const session = useRoomStore((s) => s.session);
  const join = useRoomStore((s) => s.join);
  const controls = useRoomControls();
  const status = useRoomStatus();
  const inReader = useReaderView() !== null;
  const iosNote = useIosNote();
  const now = useNow();
  if (!room || !session || !controls) return null;
  const { elsewhere, audioSuspended } = controls;
  const blocked = status === "Mic blocked";
  const notice = elsewhere || status === "Connecting…" || status === "Reconnecting…" ? status : null;

  return (
    <>
      {/* relative: the invite dropdown hangs from the head, across it. */}
      <header className="relative z-10 flex flex-none items-center gap-0.5 px-2 py-2">
        {view === "stage" ? (
          lead
        ) : (
          <>
            <button type="button" onClick={() => openPlayer("stage")} aria-label="Back to the room" title="Back" className={headButton}>
              <ArrowLeft size={20} strokeWidth={2} />
            </button>
            <h2 className="m-0 ml-1 text-[14px] font-bold text-[var(--reader-text)]">{view === "guests" ? "Guests" : "Chat"}</h2>
          </>
        )}
        <span className="flex-1" />
        <RoomHeadActions />
      </header>

      {view === "stage" && (
        <div className="flex flex-none flex-col gap-1 px-4 pt-1 pb-3">
          <h2 className="m-0 text-[15px] font-extrabold text-[var(--reader-text)]">{room.title}</h2>
          <p className="m-0 flex min-w-0 items-center gap-1.5 text-xs font-medium text-[var(--reader-text-muted)]">
            <span className="inline-flex flex-none items-center gap-1 font-bold tracking-[0.08em] text-[var(--reader-accent)] uppercase">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              Live
            </span>
            <span className="flex-none">
              · {count} listening · {formatDuration(now - Date.parse(room.startedAt))}
            </span>
            {/* <span className="min-w-0 truncate">· {room.bookTitle}</span> */}
          </p>
        </div>
      )}

      {(notice || blocked || (audioSuspended && !elsewhere) || (iosNote && !elsewhere)) && (
        <div className="mx-4 mb-3 flex flex-none flex-col gap-1 rounded-sm bg-[color-mix(in_srgb,var(--reader-accent)_8%,var(--reader-surface))] px-3 py-2 text-xs font-medium text-[var(--reader-text-muted)]">
          {notice && <span className="font-bold text-[var(--reader-accent)]">{notice}</span>}
          {blocked && (
            <span>
              <span className="font-bold text-[var(--reader-accent)]">Mic blocked.</span>{" "}
              <button
                type="button"
                onClick={() => showToast(micBlockedHelp(navigator.userAgent, isIOSDevice()))}
                className="cursor-pointer underline underline-offset-2 hover:text-[var(--reader-text)]"
              >
                How to allow it
              </button>
            </span>
          )}
          {audioSuspended && !elsewhere && (
            <button
              type="button"
              onClick={() => void session.resumeAudio()}
              className="cursor-pointer self-start font-bold text-[var(--reader-accent)] underline underline-offset-2"
            >
              Tap to resume audio
            </button>
          )}
          {iosNote && !elsewhere && <span>Keep Ominira open to keep listening. Audio stops when your screen locks.</span>}
        </div>
      )}

      {elsewhere ? (
        <div className="flex flex-1 items-center justify-center px-4">
          {/* Joining again here makes the other tab yield instead. */}
          <button
            type="button"
            onClick={() => void join(room.id).catch((err) => showToast(err instanceof Error ? err.message : "Couldn't join the room."))}
            className="flex h-10 cursor-pointer items-center justify-center rounded-sm border border-[var(--reader-accent)] bg-transparent px-4 text-[14px] font-bold text-[var(--reader-accent)]"
          >
            Use here
          </button>
        </div>
      ) : (
        <>
          <div className="om-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4">
            {view === "stage" ? (
              <RoomStage onGuests={() => openPlayer("guests")} />
            ) : view === "guests" ? (
              <RoomGuests />
            ) : (
              <div className="pt-1 pb-4">
                <RoomChatList />
              </div>
            )}
          </div>
          {view === "chat" && <RoomChatComposer materialId={room.materialId} className="flex-none border-t border-[var(--reader-border)] px-3 pt-2.5 pb-1" />}
          {inReader && (
            <div className="pointer-events-none flex flex-none flex-wrap justify-center gap-2 px-3 pt-2 empty:hidden">
              <FollowPill />
            </div>
          )}
          <div className="flex-none border-t border-[var(--reader-border)] px-3 py-2.5">
            <RoomActions view={view} onView={openPlayer} />
          </div>
        </>
      )}
    </>
  );
}

/** The head's actions: for a host in the book, bring everyone to your page
 * (spec §9); away from the book, the way back to it; invite; then Leave,
 * and for a host End room (asked first: it ends the room for everyone). */
function RoomHeadActions() {
  const session = useRoomStore((s) => s.session);
  const room = useRoom((s) => s.room);
  const isModerator = useRoomControls()?.isModerator ?? false;
  const inReader = useReaderView() !== null;
  const openRoom = useOpenRoom();
  const [ending, setEnding] = useState(false);
  if (!session || !room) return null;
  const exit = "h-9 flex-none cursor-pointer rounded-sm px-2 text-[14px] font-bold whitespace-nowrap disabled:cursor-default disabled:opacity-50";
  return (
    <>
      {isModerator && inReader && (
        <button
          type="button"
          onClick={() => {
            if (session.summonEveryone()) showToast("Everyone's reading along with you now.");
          }}
          aria-label="Bring everyone to my page"
          title="Bring everyone to my page"
          className={headButton}
        >
          <ScreenShare size={18} strokeWidth={1.75} />
        </button>
      )}
      {!inReader && (
        <button type="button" onClick={() => openRoom(room.materialId)} aria-label="Open the book" title="Open the book" className={headButton}>
          <BookOpen size={18} strokeWidth={1.75} />
        </button>
      )}
      <InviteButton room={room} />
      <button
        type="button"
        onClick={() => void useRoomStore.getState().leave()}
        className={`${exit} ml-1 ${isModerator ? "text-[var(--reader-text-muted)] hover:bg-[var(--reader-surface-hover)] hover:text-[var(--reader-text)]" : "text-red-600 hover:bg-red-600/10"}`}
      >
        Leave
      </button>
      {isModerator && (
        <button
          type="button"
          disabled={ending}
          onClick={async () => {
            const ok = await confirmAction({ title: "End the room?", message: "It ends for everyone in it.", confirmLabel: "End room", danger: true });
            if (!ok) return;
            setEnding(true);
            session.end().catch(() => {
              setEnding(false);
              showToast("Couldn't end the room. Try again.");
            });
          }}
          className={`${exit} text-red-600 hover:bg-red-600/10`}
        >
          {ending ? "Ending…" : "End room"}
        </button>
      )}
    </>
  );
}

/** The iOS line shows for a reader's first room only (spec §1.7): marked
 * seen as soon as it shows, kept for the rest of that room. */
function useIosNote(): boolean {
  const [show] = useState(() => {
    try {
      return isIOSDevice() && !localStorage.getItem(IOS_NOTE_KEY);
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      if (show) localStorage.setItem(IOS_NOTE_KEY, "1");
    } catch {}
  }, [show]);
  return show;
}

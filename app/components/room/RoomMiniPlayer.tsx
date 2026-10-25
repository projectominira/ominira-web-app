"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import MicToggle from "./MicToggle";
import FollowPill from "./FollowPill";
import { RisingReactions } from "./Reactions";
import { ChatButton } from "./RoomActions";
import RoomAvatar from "./RoomAvatar";
import RoomLive, { headButton, useRoomStatus } from "./RoomLive";
import { useBottomDock, useNarrationBarHeight } from "@/app/components/useBottomDock";
import { useFollowing, useReaderView, useRoom, useRoomControls, useVoices } from "@/lib/room/hooks";
import { useDebounced } from "@/lib/time/useDebounced";
import { useFeedStore } from "@/stores/feed-store";
import { openRoomPlayer, useLayoutStore } from "@/stores/layout-store";
import { useRoomStore } from "@/stores/room-store";

// The room's mini-player (spec §1.2), in the app shell so it survives
// leaving the reader, clear of everything docked below it — the narration
// bar and, in the reader, the chapter footer. Expanded, it's the room as a
// floating card (RoomLive) at the bottom right on desktop (across the bottom
// on phones); minimised, a pill — who's heard, chat and your mic — to give
// the page back. Opening the book's notes folds it to the pill, the notes
// sheet standing on it on phones, so the room stays a tap away.

const pillButton =
  "flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-full border transition-colors disabled:cursor-default disabled:opacity-50";

export default function RoomMiniPlayer() {
  const dock = useBottomDock();
  const narrationHeight = useNarrationBarHeight();
  const footerHeight = useLayoutStore((s) => s.readerFooterHeight);
  const below = dock.bottom + narrationHeight + footerHeight;
  const setRoomPlayerHeight = useLayoutStore((s) => s.setRoomPlayerHeight);
  const minimised = useLayoutStore((s) => s.roomPlayerMinimised);
  const setMinimised = useLayoutStore((s) => s.setRoomPlayerMinimised);
  const materialId = useRoom((s) => s.room.materialId);
  const session = useRoomStore((s) => s.session);
  const controls = useRoomControls();
  const voices = useVoices();
  const roomId = useRoom((s) => s.room.id);
  // Who the pill shows: you, until someone is heard — then them.
  const featured = useRoom((s) => voices?.[0] ?? s.roster.find((p) => p.readerId === s.readerId));
  const me = useRoom((s) => s.readerId);
  const followingId = useFollowing()?.member.readerId;
  const inReader = useReaderView() !== null;
  const feedOpen = useFeedStore((s) => inReader && s.openFor === materialId);
  useEffect(() => {
    if (feedOpen) setMinimised(true);
  }, [feedOpen, setMinimised]);
  const pill = minimised;
  const ref = useRef<HTMLDivElement>(null);

  // A room just joined opens on its stage.
  useEffect(() => {
    if (roomId) openRoomPlayer();
  }, [roomId]);

  // Only the pill keeps the page's content clear of it; the card sits over
  // the page, as a Space does.
  useEffect(() => {
    const el = ref.current;
    if (!el || !pill) return;
    // The border box: its bottom padding is the gap below the pill, which
    // whatever stacks above clears too.
    const ro = new ResizeObserver((entries) => setRoomPlayerHeight(entries[0].borderBoxSize[0].blockSize));
    ro.observe(el);
    return () => {
      ro.disconnect();
      setRoomPlayerHeight(0);
    };
  }, [setRoomPlayerHeight, pill]);

  const status = useRoomStatus();
  // Screen readers hear the line once it settles, not every flicker of who's talking.
  const announced = useDebounced(status, 1500);

  if (!controls || !session) return null;
  const { elsewhere, audioSuspended } = controls;

  return (
    <div
      ref={ref}
      data-reader-theme={dock.theme}
      className={`${dock.className} pointer-events-none flex flex-col px-3 pb-3 transition-[bottom] duration-200 ease-out shell:items-end shell:px-4 shell:pb-4`}
      // At the screen's edge, it clears the home indicator too.
      style={{ bottom: below, marginBottom: below === 0 ? "env(safe-area-inset-bottom)" : undefined }}
    >
      <span aria-live="polite" className="sr-only">
        {announced}
      </span>
      {pill ? (
        <>
          {inReader && !elsewhere && !feedOpen && (
            <div className="pointer-events-none absolute inset-x-0 bottom-full flex flex-wrap justify-center gap-2 px-3 pb-2 empty:hidden">
              <FollowPill />
            </div>
          )}
          <div className="pointer-events-auto relative flex max-w-full items-center gap-2 self-end rounded-full border border-[var(--reader-border)] bg-[var(--reader-surface)] py-1 pr-1 pl-1 shadow-md">
            {!elsewhere && <RisingReactions />}
            {featured && (
              <RoomAvatar
                member={featured}
                size={32}
                pressed={featured.readerId === followingId}
                onClick={featured.readerId !== me && !elsewhere ? () => session.follow(featured.readerId) : undefined}
              />
            )}
            {audioSuspended && !elsewhere ? (
              <button
                type="button"
                onClick={() => void session.resumeAudio()}
                className="min-w-0 cursor-pointer truncate text-xs font-bold text-[var(--reader-accent)] underline underline-offset-2"
              >
                Tap to resume audio
              </button>
            ) : (
              <span className="min-w-0 max-w-[10rem] truncate text-xs font-bold text-[var(--reader-accent)]">{status}</span>
            )}
            {!elsewhere && (
              <>
                <ChatButton onClick={() => openRoomPlayer("chat")} className={pillButton} />
                <MicToggle iconOnly className={pillButton} />
              </>
            )}
            <button
              type="button"
              onClick={() => openRoomPlayer()}
              aria-label="Show the room"
              title="Show the room"
              className="flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-full text-[var(--reader-text-muted)] hover:bg-[var(--reader-surface-hover)] hover:text-[var(--reader-text)]"
            >
              <ChevronUp size={18} strokeWidth={1.75} />
            </button>
          </div>
        </>
      ) : (
        <section
          aria-label="Reading room"
          style={{ "--below": `${below}px` } as CSSProperties}
          className="pointer-events-auto relative flex h-[min(78dvh,calc(100dvh-var(--below)-1.5rem))] w-full flex-col rounded-lg border border-[var(--reader-border)] bg-[var(--reader-surface)] shadow-lg shell:h-[min(640px,calc(100dvh-var(--below)-2rem))] shell:w-[400px]"
        >
          <RoomLive
            lead={
              <button type="button" onClick={() => setMinimised(true)} aria-label="Minimise the room" title="Minimise" className={headButton}>
                <ChevronDown size={20} strokeWidth={2} />
              </button>
            }
          />
        </section>
      )}
    </div>
  );
}

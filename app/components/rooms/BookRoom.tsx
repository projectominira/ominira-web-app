"use client";

import { useRef, useState, type ReactNode, type UIEvent } from "react";
import ShareButton from "@/app/components/materials/ShareButton";
import type { BookRoomHeader, RoomItem, RoomSession } from "@/lib/rooms/types";
import type { LocalDay } from "@/lib/time/zone";
import type { OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";
import HeadMenu from "./HeadMenu";
import InfoPanel, { InfoButton } from "./InfoPanel";
import BookCover from "@/app/components/shared/BookCover";
import PinnedBar from "./PinnedBar";
import { ScreenHead } from "./RoomScreen";
import RoomStream, { type RoomStreamHandle, type StreamHandlers } from "./RoomStream";

// A book's page (rooms-spec §2 Book room), the same on mobile and desktop,
// as a group's is: the room (its conversation), with a strip over its top
// (your progress and the resume buttons) so the book is a tap away. The
// strip slides away as you scroll down, returns as you scroll up, and
// closes with its ✕. Book info opens from the head's ⓘ or
// the title, as Group info does; a live reading room is pinned under the
// head, and joining it opens the room's own panel (RoomMiniPlayer).
// The page (BookRoomView) loads it and says whether it opens on the info.

/** The live reading room on a book, as the book room shows it. */
export type BookLive = {
  /** The session's card, while one is on. */
  card: RoomSession | null;
  onJoin?: () => void;
};

/** How far a scroll travels one way before the strip goes or returns. */
const TRAVEL = 24;

export default function BookRoom({
  header,
  onBack,
  menu,
  resume,
  infoOpen,
  onInfo,
  onCloseInfo,
  info,
  items,
  viewerId,
  today,
  loading = false,
  states,
  hasOlder,
  onLoadOlder,
  onReadToBottom,
  live = null,
  input,
  handlers,
}: {
  header: BookRoomHeader;
  onBack: () => void;
  /** The head's ⋮. */
  menu: OverflowMenuItem[];
  /** The strip's contents, given its Close. */
  resume: (onClose: () => void) => ReactNode;
  infoOpen: boolean;
  onInfo: () => void;
  onCloseInfo: () => void;
  /** Book info. */
  info: ReactNode;
  items: RoomItem[];
  viewerId: string | null;
  today: LocalDay;
  loading?: boolean;
  states?: Record<string, "sending" | "failed">;
  hasOlder?: boolean;
  onLoadOlder?: () => void;
  onReadToBottom?: () => void;
  /** The book's live reading room (6c), while one is on or you're in it;
   * its card is in `items` too. */
  live?: BookLive | null;
  input: ReactNode;
  handlers?: StreamHandlers;
}) {
  const stream = useRef<RoomStreamHandle>(null);
  const sessionAnchor = live?.card?.session.id;
  const [closed, setClosed] = useState(false);
  const [away, setAway] = useState(false);
  const scroll = useRef({ top: 0, height: 0, travel: 0 });
  // Older notes landing (the height changes) isn't the reader scrolling.
  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    const s = scroll.current;
    const moved = el.scrollTop - s.top;
    const same = s.height === el.scrollHeight;
    Object.assign(s, { top: el.scrollTop, height: el.scrollHeight });
    if (!same) return;
    s.travel = Math.sign(moved) === Math.sign(s.travel) ? s.travel + moved : moved;
    if (s.travel > TRAVEL) setAway(true);
    else if (s.travel < -TRAVEL || el.scrollTop <= 0) setAway(false);
  };

  return (
    <>
      <ScreenHead
        title={header.title}
        subtitle={header.author}
        lead={<BookCover src={header.cover} alt="" className="aspect-square w-9 rounded-full object-cover ring-1 ring-sand-950/8" />}
        onBack={onBack}
        onTitle={onInfo}
        action={
          <div className="flex items-center gap-1">
            <InfoButton label="Book info" onClick={onInfo} />
            <HeadMenu items={menu} />
          </div>
        }
      />
      <div className="flex min-h-0 flex-1" onScrollCapture={closed ? undefined : onScroll}>
        <RoomStream
          ref={stream}
          items={items}
          viewerId={viewerId}
          today={today}
          loading={loading}
          states={states}
          hasOlder={hasOlder}
          onLoadOlder={onLoadOlder}
          onReadToBottom={onReadToBottom}
          handlers={{ onJoin: live?.onJoin, ...handlers }}
          pinned={
            <PinnedBar
              flush
              session={live?.card}
              onSession={() => sessionAnchor && stream.current?.jumpTo(sessionAnchor, true)}
              onJoin={live?.onJoin}
            />
          }
          overlay={
            !closed && (
              <div
                inert={away}
                className={`absolute inset-x-0 top-0 z-10 border-b border-[var(--reader-border)] bg-[var(--reader-bg)] px-4 py-2 transition-transform duration-200 ease-out ${away ? "-translate-y-full" : ""}`}
              >
                {resume(() => setClosed(true))}
              </div>
            )
          }
          bodyClassName={`gap-4 px-4 pb-6 ${closed ? "pt-5" : "pt-18"}`}
          input={input}
        />
        {infoOpen && (
          <InfoPanel
            title="Book info"
            onClose={onCloseInfo}
            actions={<ShareButton title={header.title} text={`${header.title} by ${header.author}`} label="" iconSize={18} bordered={false} />}
          >
            {info}
          </InfoPanel>
        )}
      </div>
    </>
  );
}

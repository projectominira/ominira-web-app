"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import ShareButton from "@/app/components/materials/ShareButton";
import type { BookRoomHeader, RoomItem, RoomSession } from "@/lib/rooms/types";
import type { LocalDay } from "@/lib/time/zone";
import type { OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";
import HeadMenu from "./HeadMenu";
import InfoPanel from "./InfoPanel";
import BookmarkButton from "@/app/components/shared/BookmarkButton";
import { useShell } from "@/app/components/useShell";
import BookCover from "@/app/components/shared/BookCover";
import PinnedBar from "./PinnedBar";
import { ScreenHead } from "./RoomScreen";
import type { BubbleState } from "./NoteBubble";
import RoomStream, { type RoomStreamHandle, type StreamHandlers } from "./RoomStream";

// A book's page (rooms-spec §2 Book room), the same on mobile and desktop,
// as a group's is: the room (its conversation). Book info opens from the title, as Group info does
// (a hint under it first, then the author); the bookmark sits by the ⋮; a live reading room is pinned under the
// head, and joining it opens the room's own panel (RoomMiniPlayer).
// The page (BookRoomView) loads it and says whether it opens on the info.

/** The live reading room on a book, as the book room shows it. */
export type BookLive = {
  /** The session's card, while one is on. */
  card: RoomSession | null;
  onJoin?: () => void;
};

/** How long the head's "here for book info" hint shows before the author. */
const HINT_MS = 3000;

export default function BookRoom({
  header,
  onBack,
  menu,
  save = null,
  infoOpen,
  onInfo,
  onCloseInfo,
  info,
  items,
  viewerId,
  today,
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
  /** The bookmark beside it; absent on your own upload. */
  save?: { saved: boolean; onToggle: () => void } | null;
  infoOpen: boolean;
  onInfo: () => void;
  onCloseInfo: () => void;
  /** Book info. */
  info: ReactNode;
  items: RoomItem[];
  viewerId: string | null;
  today: LocalDay;
  states?: Record<string, BubbleState>;
  hasOlder?: boolean;
  onLoadOlder?: () => void;
  onReadToBottom?: () => void;
  /** The book's live reading room (6c), while one is on or you're in it;
   * its card is in `items` too. */
  live?: BookLive | null;
  input: ReactNode;
  handlers?: StreamHandlers;
}) {
  const wide = useShell();
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setHint(false), HINT_MS);
    return () => clearTimeout(t);
  }, []);
  const stream = useRef<RoomStreamHandle>(null);
  const sessionAnchor = live?.card?.session.id;

  return (
    <>
      <ScreenHead
        title={header.title}
        subtitle={hint ? `${wide ? "Click" : "Tap"} here for book info` : header.author}
        lead={<BookCover src={header.cover} alt="" className="size-9 flex-none rounded-full object-cover ring-1 ring-sand-950/8" />}
        onBack={onBack}
        onTitle={onInfo}
        action={
          <div className="flex items-center gap-2">
            {save && <BookmarkButton saved={save.saved} onToggle={save.onToggle} />}
            <HeadMenu items={menu} />
          </div>
        }
        actionLast
      />
      <div className="flex min-h-0 flex-1">
        <RoomStream
          ref={stream}
          items={items}
          viewerId={viewerId}
          today={today}
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

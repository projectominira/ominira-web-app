"use client";

import type { ReactNode } from "react";
import PulseDot from "@/app/components/shared/PulseDot";
import type { BookRoomHeader, RoomItem } from "@/lib/rooms/types";
import type { LocalDay } from "@/lib/time/zone";
import type { OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";
import HeadMenu from "./HeadMenu";
import { LivePane, type BookLive } from "./LivePane";
import BookCover from "@/app/components/shared/BookCover";
import { ScreenHead } from "./RoomScreen";
import RoomStream, { type StreamHandlers } from "./RoomStream";

// A book's page (rooms-spec §2 Book room) as tabs, the same on mobile and
// desktop: Room (its conversation, under a strip with your progress and
// Continue), while a reading room is on, Live (the session's card and Join,
// then the room itself, right here on the page) and Info (the book).
// The page (BookRoomView) loads it and picks the tab it opens on.

export type BookTab = "details" | "room" | "live";

export default function BookRoom({
  header,
  tab,
  onTab,
  onBack,
  menu,
  details,
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
  tab: BookTab;
  onTab: (tab: BookTab) => void;
  onBack: () => void;
  /** The head's ⋮, after Share. */
  menu: OverflowMenuItem[];
  /** The Details tab. */
  details: ReactNode;
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
  const shown = tab === "live" && !live ? "room" : tab;
  const tabs: { value: BookTab; label: ReactNode }[] = [
    { value: "room", label: "Room" },
    ...(live
      ? [
          {
            value: "live" as const,
            label: (
              <span className="flex items-center gap-1.5">
                <PulseDot tone="live" />
                Live
              </span>
            ),
          },
        ]
      : []),
    { value: "details", label: "Info" },
  ];

  return (
    <>
      <ScreenHead title={header.title} subtitle={header.author} lead={<BookCover src={header.cover} alt="" className="aspect-2/3 w-7 rounded-xs ring-1 ring-sand-950/8" />} onBack={onBack} share={{ title: header.title, text: `${header.title} by ${header.author}` }} action={<HeadMenu items={menu} />} actionLast tabs={tabs} tab={shown} onTab={onTab} />
      {shown === "details" ? (
        details
      ) : (
        <div className="relative flex min-h-0 flex-1">
          {shown === "live" && live ? (
            <LivePane live={live} viewerId={viewerId} />
          ) : (
            <RoomStream
              items={items}
              viewerId={viewerId}
              today={today}
              loading={loading}
              states={states}
              hasOlder={hasOlder}
              onLoadOlder={onLoadOlder}
              onReadToBottom={onReadToBottom}
              empty={`${header.readingNow > 0 ? `${header.readingNow} comrade${header.readingNow === 1 ? " is" : "s are"} reading this book. ` : ""}Ask a question. Share a reflection. Invite a comrade.`}
              handlers={{ onJoin: live?.onJoin, ...handlers }}
              input={input}
            />
          )}
        </div>
      )}
    </>
  );
}

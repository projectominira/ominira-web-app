"use client";

import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import type { OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";
import { useShell } from "@/app/components/useShell";
import type { RoomItem, RoomSession, RoomTarget } from "@/lib/rooms/types";
import type { LocalDay } from "@/lib/time/zone";
import { comradeCount } from "@/lib/groups/copy";
import HeadMenu from "./HeadMenu";
import { GroupAvatar } from "./RoomAvatar";
import PinnedBar from "./PinnedBar";
import { RoomFrame, type RoomOverlay } from "./RoomPanel";
import { ScreenHead, SidePanel } from "./RoomScreen";
import RoomStream, {
  type RoomStreamHandle,
  type StreamHandlers,
} from "./RoomStream";

// The study group's page (rooms-spec §2, 4a / 4b / 7a–7c): the room (the
// pinned target and reading room rows, the stream and the input), with
// Group info a side panel opened from the head, as in a WhatsApp group (a
// full panel on mobile). What the room opens on demand (the team's sheets)
// is a sheet over it on mobile and a 400 px column beside it on desktop
// (9a / 9b). The page (GroupView) loads it.

/** Wide, Group info sits at the window's right edge; on mobile it fills the room. */
const Side = ({ wide, children }: { wide: boolean; children: ReactNode }) =>
  wide ? <SidePanel>{children}</SidePanel> : <>{children}</>;

export default function GroupRoom({
  name,
  memberCount,
  aboutOpen,
  onAbout,
  onCloseAbout,
  about,
  items,
  viewerId,
  today,
  team = false,
  loading = false,
  states,
  hasOlder,
  onLoadOlder,
  onReadToBottom,
  target,
  session,
  input,
  menu = [],
  handlers,
  onBack,
  onJoinLive,
  overlay = null,
}: {
  name: string;
  memberCount: number;
  aboutOpen: boolean;
  onAbout: () => void;
  onCloseAbout: () => void;
  /** Group info. */
  about: ReactNode;
  items: RoomItem[];
  viewerId: string | null;
  today: LocalDay;
  /** Moderators: Start and Edit on the cards. */
  team?: boolean;
  loading?: boolean;
  states?: Record<string, "sending" | "failed">;
  hasOlder?: boolean;
  onLoadOlder?: () => void;
  onReadToBottom?: () => void;
  target: RoomTarget | null;
  session: RoomSession | null;
  /** The input, or Join for someone who isn't in the group. */
  input: ReactNode;
  /** The head's ⋮. */
  menu?: OverflowMenuItem[];
  handlers?: StreamHandlers;
  onBack: () => void;
  onJoinLive?: () => void;
  overlay?: RoomOverlay | null;
}) {
  const wide = useShell();
  const stream = useRef<RoomStreamHandle>(null);
  const sessionAnchor = session?.session.id;

  const more = <HeadMenu items={menu} />;

  return (
    <>
      <ScreenHead
        title={name}
        lead={<GroupAvatar name={name} size={36} />}
        subtitle={comradeCount(memberCount)}
        onBack={onBack}
        share={{ title: name, text: `Read with ${name} on Ominira` }}
        action={more}
        actionLast
        onTitle={onAbout}
      />
      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <RoomFrame wide={wide} overlay={overlay}>
            <RoomStream
              ref={stream}
              items={items}
              viewerId={viewerId}
              today={today}
              team={team}
              loading={loading}
              states={states}
              hasOlder={hasOlder}
              onLoadOlder={onLoadOlder}
              onReadToBottom={onReadToBottom}
              handlers={{ onJoin: onJoinLive, ...handlers }}
              pinned={
                <PinnedBar
                  flush
                  target={target}
                  session={session}
                  onTarget={() => stream.current?.jumpTo("target", true)}
                  onSession={() =>
                    sessionAnchor && stream.current?.jumpTo(sessionAnchor, true)
                  }
                  onJoin={onJoinLive}
                />
              }
              input={input}
            />
          </RoomFrame>
        </div>
        {aboutOpen && (
          <Side wide={wide}>
            <aside
              className={`flex flex-col bg-[var(--reader-bg)] ${wide ? "w-100 flex-none border-l border-[var(--color-app-border)]" : "absolute inset-0 z-10"}`}
            >
              <div className="flex min-h-14 flex-none items-center justify-between border-b border-[var(--color-app-border)] pr-2 pl-5">
                <span className="text-ui-lg">Group info</span>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onCloseAbout}
                  className="flex size-11 cursor-pointer items-center justify-center rounded-md hover:bg-sand-75"
                >
                  <X size={20} strokeWidth={1.75} aria-hidden />
                </button>
              </div>
              {about}
            </aside>
          </Side>
        )}
      </div>
    </>
  );
}

"use client";

import { useRef, type ReactNode } from "react";
import type { OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";
import { useShell } from "@/app/components/useShell";
import type { RoomItem, RoomSession, RoomTarget } from "@/lib/rooms/types";
import type { LocalDay } from "@/lib/time/zone";
import { comradeCount } from "@/lib/groups/copy";
import HeadMenu from "./HeadMenu";
import ShareButton from "@/app/components/materials/ShareButton";
import InfoPanel, { HEAD_PILL, InfoButton } from "./InfoPanel";
import { GroupAvatar } from "./RoomAvatar";
import PinnedBar from "./PinnedBar";
import { RoomFrame, type RoomOverlay } from "./RoomPanel";
import { ScreenHead } from "./RoomScreen";
import RoomStream, {
  type RoomStreamHandle,
  type StreamHandlers,
} from "./RoomStream";

// The study group's page (rooms-spec §2, 4a / 4b / 7a–7c): the room (the
// pinned target and reading room rows, the stream and the input), with
// Group info a side panel opened from the head's ⓘ or the name, as in a
// WhatsApp group (a full panel on mobile). What the room opens on demand (the team's sheets)
// is a sheet over it on mobile and a 400 px column beside it on desktop
// (9a / 9b). The page (GroupView) loads it.

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

  // Invite is also in Group info, where it alone lives on mobile.
  const more = (
    <div className="flex items-center gap-1">
      <InfoButton label="Group info" onClick={onAbout} />
      <ShareButton title={name} text={`Read with ${name} on Ominira`} ariaLabel="Share a link to this group" label="Invite" className={`${HEAD_PILL} hidden shell:flex`} />
      <HeadMenu items={menu} />
    </div>
  );

  return (
    <>
      <ScreenHead
        title={name}
        lead={<GroupAvatar name={name} size={36} />}
        subtitle={comradeCount(memberCount)}
        onBack={onBack}
        action={more}
        actionLast
        onTitle={onAbout}
      />
      <div className="flex min-h-0 flex-1">
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
          <InfoPanel title="Group info" onClose={onCloseAbout}>
            {about}
          </InfoPanel>
        )}
      </div>
    </>
  );
}

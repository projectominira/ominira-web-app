"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import type { OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";
import { useShell } from "@/app/components/useShell";
import type { GroupPin } from "@/lib/groups/types";
import type { RoomItem, RoomSession, RoomTarget } from "@/lib/rooms/types";
import type { LocalDay } from "@/lib/time/zone";
import { comradeCount } from "@/lib/groups/copy";
import HeadMenu from "./HeadMenu";
import InfoPanel from "./InfoPanel";
import { GroupAvatar } from "./RoomAvatar";
import PinnedBar from "./PinnedBar";
import { RoomFrame, type RoomOverlay } from "./RoomPanel";
import { ScreenHead } from "./RoomScreen";
import type { BubbleState } from "./NoteBubble";
import RoomStream, {
  type RoomStreamHandle,
  type StreamHandlers,
} from "./RoomStream";

// The study group's page (rooms-spec §2, 4a / 4b / 7a–7c): the room (the
// pinned rows, the stream and the input), with
// Group info a side panel opened from the name or the ⋮, as in a
// WhatsApp group: the head reads "Tap here for group info" a moment, then
// who's in it (a full panel on mobile). What the room opens on demand (the team's sheets)
// is a sheet over it on mobile and a 400 px column beside it on desktop
// (9a / 9b). The page (GroupView) loads it.

/** How long the head says "Tap here for group info". */
const HINT_MS = 3000;

export default function GroupRoom({
  name,
  memberCount,
  members,
  aboutOpen,
  onAbout,
  onCloseAbout,
  about,
  items,
  viewerId,
  today,
  team = false,
  states,
  hasOlder,
  onLoadOlder,
  onReadToBottom,
  pin = null,
  onOpenPin,
  onUnpin,
  target = null,
  onUnpinTarget,
  session,
  onUnpinSession,
  input,
  menu = [],
  handlers,
  onBack,
  onJoinLive,
  overlay = null,
}: {
  name: string;
  memberCount: number;
  /** "Comrades Yeast, Muiz, You"; the count until it loads. */
  members: string;
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
  states?: Record<string, BubbleState>;
  hasOlder?: boolean;
  onLoadOlder?: () => void;
  onReadToBottom?: () => void;
  /** The note pinned to the strip. */
  pin?: GroupPin | null;
  /** Opens the pinned note when it isn't loaded in the stream. */
  onOpenPin?: (id: string) => void;
  /** The moderators' unpin. */
  onUnpin?: () => void;
  /** This week's target, when pinned. */
  target?: RoomTarget | null;
  onUnpinTarget?: () => void;
  /** The strip's session: a live room, or a pinned scheduled one. */
  session: RoomSession | null;
  onUnpinSession?: () => void;
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

  // The hint first, then who's in it.
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setHint(false), HINT_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <ScreenHead
        title={name}
        lead={<GroupAvatar name={name} size={36} />}
        subtitle={hint ? `${wide ? "Click" : "Tap"} here for group info` : members || comradeCount(memberCount)}
        onBack={onBack}
        action={<HeadMenu items={[{ label: "Group info", icon: <Info size={13} />, onClick: onAbout }, ...menu]} />}
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
              states={states}
              hasOlder={hasOlder}
              onLoadOlder={onLoadOlder}
              onReadToBottom={onReadToBottom}
              handlers={{ onJoin: onJoinLive, ...handlers }}
              pinned={
                <PinnedBar
                  flush
                  pin={pin}
                  onPin={() => pin && !stream.current?.jumpTo(pin.id) && onOpenPin?.(pin.id)}
                  onUnpin={onUnpin}
                  target={target}
                  onTarget={() => stream.current?.jumpTo("target", true)}
                  onUnpinTarget={onUnpinTarget}
                  session={session}
                  onUnpinSession={onUnpinSession}
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

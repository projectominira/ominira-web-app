import type { StatusItem } from "@/lib/rooms/types";
import MyRoomCard, { type MyRoom } from "./MyRoomCard";
import StatusStrip from "./StatusStrip";

/** The rooms live now (the strip) and the one you're in. Nothing when
 * there's neither. */
export default function LiveRooms({
  strip,
  myRoom,
  desktop,
  entering,
  onPick,
  onOpen,
}: {
  strip: StatusItem[];
  myRoom: MyRoom | null;
  desktop: boolean;
  entering: boolean;
  onPick?: (item: StatusItem) => void;
  onOpen?: () => void;
}) {
  if (strip.length === 0 && !myRoom) return null;
  return (
    <div className="flex flex-col gap-4 md:mb-5">
      {strip.length > 0 && <StatusStrip items={strip} onPick={onPick ?? (() => {})} disabled={entering} className={desktop ? "" : "-mb-2 pt-1 pb-1"} />}
      {myRoom && <MyRoomCard room={myRoom} onOpen={onOpen} />}
    </div>
  );
}

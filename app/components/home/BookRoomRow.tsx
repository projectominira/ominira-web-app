import RoomRow from "@/app/components/rooms/RoomRow";
import { rowSignal } from "@/lib/rooms/home";
import type { RoomRowView } from "@/lib/rooms/types";

/** A book room in Home's chat list: its cover, opening the book's room tab. */
export default function BookRoomRow({ room: r }: { room: RoomRowView }) {
  const signal = rowSignal(r);
  return (
    <RoomRow
      href={`/library/${r.slug}?tab=room`}
      name={r.name}
      mark={{ group: false, cover: r.cover }}
      last={r.last}
      unread={r.unread}
      live={r.live !== null}
      signal={signal ? { text: signal, now: true } : null}
    />
  );
}

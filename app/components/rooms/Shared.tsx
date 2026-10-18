import PulseDot from "@/app/components/shared/PulseDot";
import { personName } from "@/lib/rooms/names";
import type { Comrade } from "@/lib/rooms/types";
import RoomAvatar from "./RoomAvatar";

// Shared room parts (rooms-spec §4, sheet #c10): who's reading now. The fist is FistReaction; avatars are RoomAvatar.

type Reader = { comrade: Comrade };

/** "6 reading now", with the forest dot. */
export function ReadingLabel({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-1.5 text-ui-xs tracking-eyebrow text-forest-500 uppercase">
      <PulseDot tone="forest" />
      {count} reading now
    </span>
  );
}

/** Who's reading, as chips; centred in the stream,
 * from the start in the book's details column. */
export function ReadingChips({ readers, start = false }: { readers: Reader[]; start?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${start ? "" : "justify-center"}`}>
      {readers.map(({ comrade }) => (
        <span
          key={comrade.readerId}
          className="box-content inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-app-border)] bg-[var(--color-app-surface)] pr-2.5 pl-1 text-ui-caption text-[var(--color-app-text-secondary)]"
        >
          <RoomAvatar comrade={comrade} size={24} />
          <b className="text-[var(--color-app-text)]">{personName(comrade.pseudonym)}</b>
        </span>
      ))}
    </div>
  );
}

/** Inline: faces and the count, in a header or a row. */
export function ReadingInline({ count, readers }: { count: number; readers: Comrade[] }) {
  return (
    <span className="flex items-center gap-1.5 self-start text-ui-caption text-[var(--color-app-text-secondary)]">
      <span className="flex">
        {readers.slice(0, 3).map((c) => (
          <RoomAvatar key={c.readerId} comrade={c} size={18} className="-mr-1.25 border-2 border-[var(--reader-bg)] last:mr-0" />
        ))}
      </span>
      <span className="pl-1 font-bold text-forest-500">{count} reading now</span>
    </span>
  );
}

/** The stream's "reading now" item: the label over the chips. */
export function ReadingNow({ count, readers }: { count: number; readers: Reader[] }) {
  return (
    <div className="flex flex-col items-center gap-2 py-1">
      <ReadingLabel count={count} />
      <ReadingChips readers={readers} />
    </div>
  );
}

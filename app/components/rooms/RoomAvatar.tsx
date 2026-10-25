import ReaderAvatar from "@/app/components/shared/ReaderAvatar";
import type { Comrade } from "@/lib/rooms/types";

/** A person in a room (sheet #c10 Avatar): the reader's own avatar, or the
 * Ominira mark on ink for the official account. */
export default function RoomAvatar({
  comrade,
  size,
  official = false,
  className = "",
}: {
  comrade: Comrade;
  size: number;
  official?: boolean;
  className?: string;
}) {
  if (official) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className={`block flex-none rounded-full bg-sand-950 bg-[url(/images/ominira-mark.png)] bg-size-[62%] bg-center bg-no-repeat ${className}`}
      />
    );
  }
  return <ReaderAvatar pseudonym={comrade.pseudonym} avatar={comrade.avatar} size={size} className={className} />;
}

/** A group's mark: its first letter on oxblood, one letter like every
 * reader's avatar ("Rodney Reading Group" -> R). Groups have no picture. */
export function GroupAvatar({ name, size = 40, fontSize = 14 }: { name: string; size?: number; fontSize?: number }) {
  const initials = name.trim().charAt(0).toUpperCase();
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize }}
      className="flex flex-none items-center justify-center rounded-full bg-oxblood-500 font-sans leading-none font-bold text-sand-25"
    >
      {initials}
    </span>
  );
}

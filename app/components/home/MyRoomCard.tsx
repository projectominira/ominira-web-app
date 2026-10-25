import InviteButton from "@/app/components/room/InviteButton";

/** The room you're in, as Home's card needs it. */
export type MyRoom = { id: string; title: string; bookTitle: string };

/** The room you're in: invite comrades, or go back into it. */
export default function MyRoomCard({ room, onOpen }: { room: MyRoom; onOpen?: () => void }) {
  return (
    <section className="flex flex-col gap-3 rounded-sm bg-[color-mix(in_srgb,var(--reader-accent)_10%,var(--reader-surface))] p-4">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-extrabold tracking-eyebrow text-[var(--color-app-brand)]">YOU’RE IN A ROOM</span>
        <h3 className="m-0 font-serif text-[17px] font-semibold text-[var(--reader-text)]">{room.title}</h3>
      </div>
      <div className="flex gap-2">
        <InviteButton room={room} solid />
        <button
          type="button"
          onClick={onOpen}
          className="h-11 cursor-pointer rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)] px-4 text-[13px] font-bold text-[var(--reader-text)] transition-colors hover:bg-[var(--reader-surface-hover)]"
        >
          Open
        </button>
      </div>
    </section>
  );
}

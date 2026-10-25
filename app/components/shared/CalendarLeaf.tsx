import { formatInstant } from "@/lib/time/format";

/** A calendar leaf (sheet 1.3): month band, day, weekday, in the viewer's
 * zone. `next` and `later` are the rooms' compact leaf (Rooms v4 sheet #c8):
 * day over month on a tinted block, brand for the next session. */
export default function CalendarLeaf({ instant, variant = "leaf" }: { instant: string; variant?: "leaf" | "next" | "later" }) {
  if (variant !== "leaf") {
    return (
      <span
        aria-hidden
        className={`flex w-12 flex-none flex-col items-center rounded-sm py-1.5 font-sans ${
          variant === "next" ? "bg-brand-50 text-brand-700" : "bg-sand-100 text-[var(--color-app-text-secondary)]"
        }`}
      >
        <span className="text-[18px]/none font-extrabold">{formatInstant(instant, "dayNumber")}</span>
        <span className="text-[10px]/[1.4] font-bold uppercase">{formatInstant(instant, "monthShort")}</span>
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="flex w-14 flex-none flex-col items-center overflow-hidden rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)]"
    >
      <span className="self-stretch bg-brand-500 py-0.5 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-white">
        {formatInstant(instant, "monthShort")}
      </span>
      <span className="pt-1.5 font-serif text-2xl leading-none font-semibold text-[var(--reader-text)]">
        {formatInstant(instant, "dayNumber")}
      </span>
      <span className="pt-0.5 pb-1.5 text-[11px] text-[var(--reader-text-muted)]">{formatInstant(instant, "weekdayShort")}</span>
    </span>
  );
}

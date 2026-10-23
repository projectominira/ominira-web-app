"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { weekChain } from "@/lib/rooms/home";
import { dayLabel } from "@/lib/streaks/history";
import { useStreak } from "@/lib/streaks/hooks";

/** Shelf's window onto /history, beside its title: this week as a row of
 * dots and the streak, the whole a way into the calendar. Quiet on
 * purpose: the books below are the page; this is when they were read. */
export default function HabitWindow() {
  const { data } = useStreak();
  if (!data) return null;
  const { state } = data;
  const days = state.kind === "none" || state.kind === "ended" ? 0 : state.days;
  const label = days ? `${days}-day streak` : "History";
  return (
    <Link
      href="/history"
      aria-label={`${days ? `${label}. ` : ""}Reading history`}
      className="flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-ui-sm text-[var(--color-app-text-secondary)] transition-colors hover:bg-sand-75"
    >
      <span className="flex items-center gap-1" aria-hidden>
        {weekChain(data).map((d) => (
          <span
            key={d.day}
            title={dayLabel(d.day)}
            className={`size-2 rounded-full ${
              d.state === "done" ? "bg-brand-500" : d.state === "today" ? "ring-1 ring-brand-500 ring-inset" : "bg-[var(--color-app-surface-muted)]"
            }`}
          />
        ))}
      </span>
      <span className="font-bold whitespace-nowrap text-[var(--color-app-text)]">{label}</span>
      <ChevronRight size={15} strokeWidth={1.75} aria-hidden className="-ml-1 text-[var(--color-app-text-muted)]" />
    </Link>
  );
}

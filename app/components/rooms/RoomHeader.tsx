"use client";

import { BookOpen, Headphones } from "lucide-react";
import Tooltip from "@/app/components/reader/Tooltip";
import type { BookRoomHeader } from "@/lib/rooms/types";

const ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;

export const ModeIcon = ({ listening, size }: { listening: boolean; size: number }) =>
  listening ? <Headphones size={size} {...ICON} /> : <BookOpen size={size} {...ICON} />;

/** The resume button and its mode switch, shared with Home's book card. */
export const RESUME = "flex cursor-pointer items-center justify-center gap-2 rounded-sm bg-brand-500 text-sm font-semibold whitespace-nowrap text-white hover:bg-brand-600";
export const SWITCH = "flex flex-none cursor-pointer items-center justify-center rounded-sm border border-[var(--reader-border)] bg-transparent text-[var(--reader-text)] hover:bg-[var(--reader-surface)]";

type ResumeProps = {
  /** Only the CTA and the mode it resumes in. */
  header: Pick<BookRoomHeader, "cta" | "listening">;
  audiobook: boolean;
  ready: boolean;
  onContinue: () => void;
  onSwitch: () => void;
};

/** The book's two reading actions, on its info and in the room's head
 * alike: resume in the mode last used, and the switch to the other mode
 * (Listen, or Switch to reading). Held as a placeholder until the server's
 * position lands (`ready`), so it never resumes from a stale one. `compact`:
 * a group's target card. */
export function ResumeButtons({ header: h, audiobook, ready, onContinue, onSwitch, compact = false }: ResumeProps & { compact?: boolean }) {
  const other = h.listening ? "Switch to reading" : audiobook ? "Listen (audiobook)" : "Listen";
  const size = compact ? "flex-1 px-4 py-2" : "flex-1 px-6 py-2.5 shell:flex-none";
  return (
    <div className={`flex items-center justify-center ${compact ? "gap-1.5" : "gap-2"}`}>
      {ready ? (
        <button
          type="button"
          onClick={onContinue}
          className={`${RESUME} ${size}`}
        >
          <ModeIcon listening={h.listening} size={16} />
          {h.cta}
        </button>
      ) : (
        <div aria-hidden className={`animate-pulse rounded-sm bg-[var(--reader-surface-hover)] text-sm font-semibold text-transparent ${size}`}>
          Start reading
        </div>
      )}
      <Tooltip label={other}>
        <button
          type="button"
          aria-label={other}
          onClick={onSwitch}
          disabled={!ready}
          className={`${SWITCH} ${compact ? "p-2" : "p-2.5"}`}
        >
          <ModeIcon listening={!h.listening} size={18} />
        </button>
      </Tooltip>
    </div>
  );
}

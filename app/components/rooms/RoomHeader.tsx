"use client";

import { BookOpen, Headphones } from "lucide-react";
import Tooltip from "@/app/components/reader/Tooltip";
import type { BookRoomHeader } from "@/lib/rooms/types";

const ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;

export const ModeIcon = ({ listening, size }: { listening: boolean; size: number }) =>
  listening ? <Headphones size={size} {...ICON} /> : <BookOpen size={size} {...ICON} />;

/** The book's two reading actions, on the Info tab and in the room's strip
 * alike: resume in the mode last used, and the switch to the other mode
 * (Listen, or Switch to reading). Held as a placeholder until the server's
 * position lands (`ready`), so it never resumes from a stale one. */
export function ResumeButtons({
  header: h,
  audiobook,
  ready,
  onContinue,
  onSwitch,
}: {
  header: BookRoomHeader;
  audiobook: boolean;
  ready: boolean;
  onContinue: () => void;
  onSwitch: () => void;
}) {
  const other = h.listening ? "Switch to reading" : audiobook ? "Listen (audiobook)" : "Listen";
  return (
    <div className="flex items-center justify-center gap-2">
      {ready ? (
        <button
          type="button"
          onClick={onContinue}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-sm bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 shell:flex-none"
        >
          <ModeIcon listening={h.listening} size={16} />
          {h.cta}
        </button>
      ) : (
        <div aria-hidden className="flex-1 animate-pulse rounded-sm bg-[var(--reader-surface-hover)] px-6 py-2.5 text-sm font-semibold text-transparent shell:flex-none">
          Start reading
        </div>
      )}
      <Tooltip label={other}>
        <button
          type="button"
          aria-label={other}
          onClick={onSwitch}
          disabled={!ready}
          className="flex flex-none cursor-pointer items-center justify-center rounded-sm border border-[var(--reader-border)] bg-transparent p-2.5 text-[var(--reader-text)] hover:bg-[var(--reader-surface)]"
        >
          <ModeIcon listening={!h.listening} size={18} />
        </button>
      </Tooltip>
    </div>
  );
}

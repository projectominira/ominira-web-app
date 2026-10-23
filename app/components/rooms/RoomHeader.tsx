"use client";

import { BookOpen, Headphones, X } from "lucide-react";
import Tooltip from "@/app/components/reader/Tooltip";
import type { BookRoomHeader } from "@/lib/rooms/types";

const ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;

export const ModeIcon = ({ listening, size }: { listening: boolean; size: number }) =>
  listening ? <Headphones size={size} {...ICON} /> : <BookOpen size={size} {...ICON} />;

type ResumeProps = {
  header: BookRoomHeader;
  audiobook: boolean;
  ready: boolean;
  onContinue: () => void;
  onSwitch: () => void;
};

/** The book's two reading actions, on its info and in the room's head
 * alike: resume in the mode last used, and the switch to the other mode
 * (Listen, or Switch to reading). Held as a placeholder until the server's
 * position lands (`ready`), so it never resumes from a stale one. `compact`:
 * the room's strip. */
export function ResumeButtons({ header: h, audiobook, ready, onContinue, onSwitch, compact = false }: ResumeProps & { compact?: boolean }) {
  const other = h.listening ? "Switch to reading" : audiobook ? "Listen (audiobook)" : "Listen";
  const size = compact ? "px-3 py-2" : "flex-1 px-6 py-2.5 shell:flex-none";
  return (
    <div className={`flex items-center justify-center ${compact ? "gap-1.5" : "gap-2"}`}>
      {ready ? (
        <button
          type="button"
          onClick={onContinue}
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-sm bg-brand-500 text-sm font-semibold whitespace-nowrap text-white hover:bg-brand-600 ${size}`}
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
          className={`flex flex-none cursor-pointer items-center justify-center rounded-sm border border-[var(--reader-border)] bg-transparent text-[var(--reader-text)] hover:bg-[var(--reader-surface)] ${compact ? "p-2" : "p-2.5"}`}
        >
          <ModeIcon listening={!h.listening} size={18} />
        </button>
      </Tooltip>
    </div>
  );
}

/** The strip over a book's room: how much is done (once started) beside
 * the two reading actions, and Close. Not started, the actions lead. */
export function ReadingBar({ onClose, ...props }: ResumeProps & { onClose: () => void }) {
  const { header: h, ready } = props;
  const started = ready && h.pct !== null;
  return (
    <div className={`relative mx-auto flex w-full max-w-[640px] items-center gap-3 ${started ? "" : "justify-center"}`}>
      {started && (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-sand-100">
            <span style={{ width: `${h.pct}%` }} className="block h-full rounded-full bg-brand-500" />
          </span>
          <span className="flex-none text-ui-caption font-bold text-[var(--color-app-text-secondary)]">{h.pct}%</span>
        </div>
      )}
      <ResumeButtons {...props} compact />
      <button type="button" aria-label="Close" onClick={onClose} className={`-mr-2 flex size-9 flex-none cursor-pointer items-center justify-center rounded-sm text-[var(--color-app-text-muted)] hover:bg-[var(--reader-surface-hover)] ${started ? "ml-auto" : "absolute right-0"}`}>
        <X size={18} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

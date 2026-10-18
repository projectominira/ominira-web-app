"use client";

import { Plus } from "lucide-react";
import BookCover from "@/app/components/shared/BookCover";
import { statusLook } from "@/lib/rooms/home";
import type { StatusItem } from "@/lib/rooms/types";
import { GroupAvatar } from "./RoomAvatar";

const TILE = "flex w-19 flex-none cursor-pointer flex-col items-center gap-2.5 border-none bg-transparent p-0 text-[var(--color-app-text)] disabled:cursor-default disabled:opacity-60";
const LABEL = "block truncate font-sans text-[12px]/[1.3] font-semibold";

/**
 * The status strip (home-spec §2 Home 1, the sheet's App chrome): reading
 * rooms, sideways. "Start a room" leads when you can start one; then the
 * rooms live now — a brand ring and a LIVE badge (a `sand-300` ring for a
 * group's "reading", once groups are in). The group is its letter. `onPick`
 * joins; the caller sets the padding. Home shows its own card instead when
 * nothing's live.
 */
export default function StatusStrip({
  items,
  onPick,
  onStart,
  disabled = false,
  className = "",
}: {
  items: StatusItem[];
  onPick: (item: StatusItem) => void;
  /** Shows "Start a room" first. */
  onStart?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex gap-2.5 overflow-x-auto [scrollbar-width:none] ${className}`}>
      {onStart && (
        <button type="button" onClick={onStart} disabled={disabled} aria-label="Start a reading room" className={TILE}>
          <span className="block rounded-[10px] border-2 border-dashed border-sand-300 p-0.75">
            <span className="flex aspect-2/3 w-11 items-center justify-center rounded-xs bg-[var(--reader-surface)] text-[var(--color-app-brand)]">
              <Plus size={20} strokeWidth={2.25} />
            </span>
          </span>
          <span className="w-full min-w-0 text-center">
            <span className={LABEL}>Start a room</span>
            <span className="block font-sans text-[11px]/[1.3] font-medium text-[var(--color-app-text-muted)]">Read together</span>
          </span>
        </button>
      )}
      {items.map((s) => {
        const { caption } = statusLook(s);
        const live = s.reason === "live";
        const group = s.kind === "group";
        return (
          <button
            key={`${s.kind}:${s.id}`}
            type="button"
            onClick={() => onPick(s)}
            disabled={disabled}
            aria-label={`${live ? "Join " : ""}${s.label}, ${caption}`}
            className={TILE}
          >
            {/* 10 px: between rounded-sm and rounded-md (home-spec §3). */}
            <span className={`relative block border-2 p-0.75 ${group ? "rounded-full" : "rounded-[10px]"} ${live ? "border-brand-500" : "border-sand-300"}`}>
              {group ? (
                <GroupAvatar name={s.name} size={44} fontSize={17} />
              ) : (
                <BookCover src={s.cover} alt="" className="aspect-2/3 w-11 rounded-xs ring-1 ring-sand-950/8" iconSize={16} />
              )}
              {live && (
                <span className="absolute -bottom-2.25 left-1/2 -translate-x-1/2 rounded-2xs border-2 border-[var(--reader-bg)] bg-brand-500 px-1.5 py-0.75 font-sans text-[10px]/none font-extrabold tracking-eyebrow text-sand-25">
                  LIVE
                </span>
              )}
            </span>
            <span className="w-full min-w-0 text-center">
              <span className={LABEL}>{s.label}</span>
              <span className={`block font-sans text-[11px]/[1.3] font-medium ${live ? "text-[var(--color-app-brand)]" : "text-[var(--color-app-text-muted)]"}`}>{caption}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

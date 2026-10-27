"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, Navigation, X } from "lucide-react";
import ReaderAvatar from "@/app/components/shared/ReaderAvatar";
import { pseudonymToSlug } from "@/lib/reader/profileSlug";
import { positionLabel } from "@/lib/room/follow";
import { narratorName, roleOf } from "@/lib/room/presence";
import { useFollowing, usePlace, useReaderView, useRoom, useVoice } from "@/lib/room/hooks";

// A room member's card, opened by a tap on their face (RoomAvatar): who they
// are, their role and where they are in the book, then Read along (spec
// §1.6) and their profile. A tap alone never follows: it might only be
// asking who they are. Sized like the room panel's rows — 13px name, 12px
// line, 13px buttons.

const WIDTH = 256;
const GAP = 8;
/** The page's side gutter, kept clear of the card. */
const GUTTER = 16;

export default function MemberCard({
  readerId,
  anchor,
  readAlong,
  onClose,
}: {
  readerId: string;
  /** The face it opened from: placed under it, or over it near the bottom. */
  anchor: HTMLElement;
  /** Toggles reading along; absent for yourself, or where you can't. */
  readAlong?: () => void;
  onClose: () => void;
}) {
  const member = useRoom((s) => s.roster.find((p) => p.readerId === readerId));
  const { speaking } = useVoice(readerId);
  const place = usePlace(readerId);
  const view = useReaderView();
  const readingAlong = useFollowing()?.member.readerId === readerId;
  const card = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // The portal leaves the face's subtree, so it carries the theme the face sits in.
  const [theme] = useState(() => anchor.closest("[data-reader-theme]")?.getAttribute("data-reader-theme") ?? undefined);

  useLayoutEffect(() => {
    const a = anchor.getBoundingClientRect();
    const height = card.current?.offsetHeight ?? 0;
    const below = a.bottom + GAP + height <= window.innerHeight - GUTTER;
    const left = Math.min(Math.max(a.left + a.width / 2 - WIDTH / 2, GUTTER), window.innerWidth - WIDTH - GUTTER);
    setPos({ top: below ? a.bottom + GAP : Math.max(GUTTER, a.top - GAP - height), left });
  }, [anchor]);

  // Escape, a tap elsewhere, or the page moving under it closes it. Escape
  // goes no further, so a sheet behind the card stays open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!card.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);

  if (!member) return null;
  const name = member.name;
  const narrator = narratorName(member);
  const status = narrator
    ? `${narrator} narrating`
    : speaking
      ? "Speaking"
      : member.handRaisedAt !== null
        ? "Hand raised"
        : positionLabel(member, place, view)?.text;
  const button = "flex h-9 cursor-pointer items-center justify-center gap-2 rounded-sm text-[13px] font-bold no-underline transition-colors";

  return createPortal(
    <div
      ref={card}
      role="dialog"
      aria-label={name}
      data-reader-theme={theme}
      // React still bubbles through the portal: keep a tap here from reaching
      // whatever holds the face (a sheet's backdrop, the margin).
      onClick={(e) => e.stopPropagation()}
      style={{ width: WIDTH, maxWidth: `calc(100vw - ${GUTTER * 2}px)`, top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}
      className="reader-menu-in fixed z-[130] flex flex-col gap-3 rounded-md border border-[var(--reader-border)] bg-[var(--reader-surface)] p-3.5 shadow-lg"
    >
      <div className="flex min-w-0 items-center gap-3">
        <ReaderAvatar pseudonym={member.name} avatar={member.avatar} size={40} className="flex-none" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[13px] font-bold text-[var(--reader-text)]">{name}</span>
          <span
            className={`truncate text-xs ${
              speaking || narrator ? "font-bold text-[var(--reader-accent)]" : "font-medium text-[var(--reader-text-muted)]"
            }`}
          >
            {[roleOf(member), status].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {readAlong && (
          <button
            type="button"
            onClick={() => {
              readAlong();
              onClose();
            }}
            aria-pressed={readingAlong}
            className={`${button} ${
              readingAlong
                ? "border border-[var(--reader-border)] bg-transparent text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]"
                : "border-none bg-brand-500 text-white hover:bg-brand-600"
            }`}
          >
            {readingAlong ? <X size={15} strokeWidth={2.25} /> : <Navigation size={15} strokeWidth={2.25} />}
            {readingAlong ? "Stop reading along" : "Read along"}
          </button>
        )}
        <Link
          href={`/@${pseudonymToSlug(member.name)}`}
          onClick={onClose}
          className={`${button} border border-[var(--reader-border)] text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]`}
        >
          View profile
          <ArrowRight size={15} strokeWidth={2.25} />
        </Link>
      </div>
    </div>,
    document.body
  );
}

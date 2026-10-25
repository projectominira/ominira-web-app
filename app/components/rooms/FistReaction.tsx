"use client";

import Link from "next/link";
import { HandFist, MessageCircle } from "lucide-react";

/** The raised fist (Note.dc.html's icon, Lucide's 1.75 stroke). */
export function FistIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 11V7.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M10 10V6a1.5 1.5 0 0 1 3 0v4" />
      <path d="M13 10V6.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M16 10V8.5a1.5 1.5 0 0 1 3 0V13a6 6 0 0 1-6 6h-1a5 5 0 0 1-5-5v-3a1.5 1.5 0 0 1 3 0v1h3" />
      <path d="M9 19v3" />
      <path d="M15 19v3" />
    </svg>
  );
}

/** main's reaction pill (ReactionButton): the fist and count in one
 * bordered, fully rounded pill. `sm` is its small size. */
export default function FistReaction({
  count,
  on,
  size = "md",
  onToggle,
}: {
  count: number;
  on: boolean;
  size?: "sm" | "md";
  onToggle?: () => void;
}) {
  const small = size === "sm";
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label="Raise a fist"
      onClick={onToggle}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border font-semibold transition-colors ${
        small ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
      } ${
        on
          ? "border-brand-500 bg-brand-500/10 text-brand-500"
          : "border-[var(--reader-border)] bg-[var(--reader-surface)] text-[var(--reader-text-muted)] hover:border-brand-500 hover:bg-brand-500/5 hover:text-brand-500"
      }`}
    >
      <HandFist size={small ? 11 : 13} aria-hidden />
      {count}
    </button>
  );
}

const REPLY = "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--reader-border)] bg-[var(--reader-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--reader-text-muted)] transition-colors hover:bg-[var(--reader-surface-hover)] hover:text-[var(--reader-text)]";

/** main's ReplyButton: "Reply" at none, else "1 reply" / "6 replies". A link
 * when given `href`. */
export function ReplyPill({ count, onClick, href }: { count: number; onClick?: () => void; href?: string }) {
  const inner = (
    <>
      <MessageCircle size={13} aria-hidden />
      {count === 0 ? "Reply" : `${count} ${count === 1 ? "reply" : "replies"}`}
    </>
  );
  if (href)
    return (
      <Link href={href} className={REPLY}>
        {inner}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={REPLY}>
      {inner}
    </button>
  );
}

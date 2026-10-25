"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import BottomSheet from "@/app/components/shared/BottomSheet";
import TagPicker, { chipFace } from "@/app/components/shared/TagPicker";
import { useShell } from "@/app/components/useShell";
import { useMentionCandidates } from "@/lib/community/useMentions";
import { MAX_MENTIONS, type MentionCandidate } from "@/lib/community/mentionTypes";
import { comradeName } from "@/lib/reader/authorDisplay";
import { showToast } from "@/stores/toast-store";
import { useReaderStore } from "@/stores/reader-store";
import { primaryButton } from "@/app/components/groups/buttons";

type InviteProps = {
  /** "Invite to {name}": the dialog's label, and the sheet's title. */
  ariaLabel: string;
  /** Marks this group's members in the matches. */
  groupSlug?: string | null;
  share: ReactNode;
  send: (readerIds: string[], done: { onSuccess: () => void; onError: (err: unknown) => void }) => void;
  onFail: (err: unknown) => void;
};

/** Tag comrades and Send invite, with the caller's `share` beside it. */
function InviteBody({ groupSlug = null, share, send, onFail, onClose }: Omit<InviteProps, "ariaLabel"> & { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [tagged, setTagged] = useState<MentionCandidate[]>([]);
  const [pending, setPending] = useState(false);
  const { data: candidates = [] } = useMentionCandidates(query, groupSlug);

  const tag = (c: MentionCandidate) => {
    if (tagged.length >= MAX_MENTIONS) return;
    setTagged((t) => [...t, c]);
    setQuery("");
  };
  const untag = (readerId: string) => setTagged((t) => t.filter((x) => x.readerId !== readerId));
  const submit = () => {
    setPending(true);
    send(
      tagged.map((t) => t.readerId),
      {
        onSuccess: () => {
          setPending(false);
          showToast(tagged.length === 1 ? `Invite sent to ${comradeName(tagged[0].pseudonym)}` : `Invite sent to ${tagged.length} comrades`);
          onClose();
        },
        onError: (err) => {
          setPending(false);
          onFail(err);
        },
      }
    );
  };

  return (
    <TagPicker
      query={query}
      onQuery={setQuery}
      chips={tagged.map((t) => ({ key: t.readerId, label: comradeName(t.pseudonym), face: chipFace(t), onRemove: () => untag(t.readerId) }))}
      suggestions={candidates.filter((c) => !tagged.some((t) => t.readerId === c.readerId))}
      onPick={tag}
      membersTaggable={false}
      onClose={onClose}
      footer={
        <>
          {share}
          <button type="button" onClick={submit} disabled={tagged.length === 0 || pending} className={primaryButton}>
            Send invite
          </button>
        </>
      }
    />
  );
}

/** The invite on its own: the whole screen on mobile, with ✕ to close; a
 * centred card on desktop. */
export function InviteSheet({ onClose, ...props }: InviteProps & { onClose: () => void }) {
  const wide = useShell();
  const theme = useReaderStore((s) => s.theme);
  useEffect(() => {
    if (wide) return; // BottomSheet has its own.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [wide, onClose]);

  if (wide)
    return (
      <BottomSheet title={props.ariaLabel} onClose={onClose}>
        <InviteBody {...props} onClose={onClose} />
      </BottomSheet>
    );
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      data-reader-theme={theme}
      role="dialog"
      aria-modal="true"
      aria-label={props.ariaLabel}
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      className="fixed inset-0 z-[120] flex flex-col bg-[var(--reader-bg)] text-[var(--reader-text)]"
    >
      <div className="flex flex-none items-center gap-2 border-b border-[var(--reader-border)] px-2 py-1.5">
        <button type="button" aria-label="Close" onClick={onClose} className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-sm hover:bg-[var(--reader-surface-hover)]">
          <X size={20} strokeWidth={1.75} aria-hidden />
        </button>
        <h2 className="m-0 min-w-0 truncate text-[15px] font-bold">{props.ariaLabel}</h2>
      </div>
      <div className="om-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <InviteBody {...props} onClose={onClose} />
      </div>
    </div>,
    document.body
  );
}

/**
 * The Invite dropdown (a study group's, a reading room's): tag comrades
 * (TagPicker, members marked) and Send invite notifies each one; the
 * caller's `share` keeps the plain link. Anchored to its trigger on
 * desktop; the whole screen on mobile (InviteSheet).
 */
export default function InviteDropdown({
  label = "Invite",
  icon: Icon,
  triggerClassName,
  iconSize = 15,
  className,
  align = "left",
  anchored = true,
  ...props
}: InviteProps & {
  label?: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  triggerClassName: string;
  iconSize?: number;
  /** The wrapper's, for a trigger that fills a row. */
  className?: string;
  /** Which edge of the trigger the dropdown lines up with. */
  align?: "left" | "right";
  /** false: the dropdown hangs from the nearest positioned ancestor rather
   * than the trigger, spanning it (the room panel's head). */
  anchored?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wide = useShell();
  const theme = useReaderStore((s) => s.theme);
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number; width: number } | null>(null);

  // Fixed to the window, so it never changes a parent's layout or scroll; the
  // card is clamped inside the viewport whatever edge its trigger sits on.
  useLayoutEffect(() => {
    if (!open || !wide || !root.current) return setPlace(null);
    const gap = 8;
    const trigger = root.current.getBoundingClientRect();
    const span = anchored ? null : (root.current.offsetParent?.getBoundingClientRect() ?? null);
    const width = Math.min(span ? span.width - 16 : 340, window.innerWidth - 2 * gap);
    const from = span ? span.left + 8 : align === "right" ? trigger.right - width : trigger.left;
    setPlace({ top: trigger.bottom + 6, left: Math.max(gap, Math.min(from, window.innerWidth - gap - width)), width });
  }, [open, wide, anchored, align]);

  useEffect(() => {
    if (!open || !wide) return;
    const close = (e: Event) => !card.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, wide]);

  useEffect(() => {
    if (!open || !wide) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, wide]);

  return (
    <div ref={root} className={`${anchored ? "relative" : ""} flex flex-col ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        // Icon only: the dialog's label names it.
        {...(label ? {} : { "aria-label": props.ariaLabel, title: "Invite" })}
        className={triggerClassName}
      >
        <Icon size={iconSize} strokeWidth={iconSize > 15 ? 1.75 : 2} />
        {label}
      </button>
      {open && !wide && <InviteSheet {...props} onClose={() => setOpen(false)} />}
      {open &&
        wide &&
        place &&
        createPortal(
          <div data-reader-theme={theme} className="text-[var(--reader-text)]">
            <div onClick={() => setOpen(false)} className="fixed inset-0 z-[119]" />
            <div
              ref={card}
              role="dialog"
              aria-label={props.ariaLabel}
              style={place}
              className="reader-menu-in fixed z-[120] rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)] p-2 shadow-md"
            >
              <InviteBody {...props} onClose={() => setOpen(false)} />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

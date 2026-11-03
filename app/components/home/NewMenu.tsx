"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import BottomSheet from "@/app/components/shared/BottomSheet";

export type NewAction = { label: string; icon: ReactNode; onClick: () => void };

/** The actions as plain rows: a muted icon and the label. */
function Actions({ actions, onPick }: { actions: NewAction[]; onPick: (a: NewAction) => void }) {
  return (
    <div role="menu" className="flex flex-col">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          role="menuitem"
          onClick={() => onPick(a)}
          className="flex w-full cursor-pointer items-center gap-3 rounded-sm border-none bg-transparent px-3 py-2.5 text-left text-[13px] font-medium text-[var(--reader-text)] transition-colors outline-none hover:bg-[var(--reader-surface-hover)] focus-visible:bg-[var(--reader-surface-hover)]"
        >
          <span aria-hidden className="flex flex-none text-[var(--reader-text-muted)]">
            {a.icon}
          </span>
          {a.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Study groups' ＋ (WhatsApp's "New chat"): a round icon button that opens
 * what you can start — anchored under it on desktop, a bottom sheet on
 * mobile. Picking one closes it; Escape and outside clicks do too.
 */
export default function NewMenu({ actions, desktop, disabled = false }: { actions: NewAction[]; desktop: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || !desktop) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, desktop]);

  if (actions.length === 0) return null;
  const pick = (a: NewAction) => {
    setOpen(false);
    a.onClick();
  };

  return (
    <div className="relative flex-none">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Start something new"
        className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-full border border-[var(--reader-border)] bg-[var(--reader-bg)] p-0 text-[var(--reader-text)] transition-colors hover:border-brand-200 hover:bg-[color-mix(in_srgb,var(--reader-accent)_10%,var(--reader-surface))] disabled:cursor-default disabled:opacity-60"
      >
        <Plus size={16} strokeWidth={2} />
      </button>
      {open &&
        (desktop ? (
          <>
            <div onClick={() => setOpen(false)} className="fixed inset-0 z-19" />
            <div className="reader-menu-in absolute top-11 right-0 z-20 w-58 origin-top-right rounded-sm border border-[var(--reader-border)] bg-[var(--reader-bg)] p-1.5 shadow-md">
              <Actions actions={actions} onPick={pick} />
            </div>
          </>
        ) : (
          <BottomSheet title="Start something new" onClose={() => setOpen(false)}>
            <div className="-mx-3">
              <Actions actions={actions} onPick={pick} />
            </div>
          </BottomSheet>
        ))}
    </div>
  );
}

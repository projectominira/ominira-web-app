"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import BottomSheet from "@/app/components/shared/BottomSheet";

export type NewAction = { label: string; sub: string; icon: ReactNode; onClick: () => void };

const TINT = "bg-[color-mix(in_srgb,var(--reader-accent)_10%,var(--reader-surface))]";

/** The actions as rows: a tinted icon, the title and what it is. */
function Actions({ actions, onPick }: { actions: NewAction[]; onPick: (a: NewAction) => void }) {
  return (
    <div role="menu" className="flex flex-col">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          role="menuitem"
          onClick={() => onPick(a)}
          className="flex w-full cursor-pointer items-center gap-3 rounded-sm border-none bg-transparent px-2.5 py-2.5 text-left text-[var(--reader-text)] transition-colors outline-none hover:bg-[var(--reader-surface-hover)] focus-visible:bg-[var(--reader-surface-hover)]"
        >
          <span aria-hidden className={`flex size-10 flex-none items-center justify-center rounded-full text-[var(--color-app-brand)] ${TINT}`}>
            {a.icon}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-ui-body font-bold">{a.label}</span>
            <span className="text-ui-caption text-[var(--reader-text-muted)]">{a.sub}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Community's "＋ Start" (WhatsApp's "New chat"): a brand text button, like the Library's "Add a book", that opens
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
        className="flex flex-none cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[13px] font-bold text-brand-500 transition-colors hover:text-brand-600 disabled:cursor-default disabled:opacity-60"
      >
        <Plus size={15} strokeWidth={2.5} className={`transition-transform duration-200 ${open ? "rotate-45" : ""}`} />
        Start
      </button>
      {open &&
        (desktop ? (
          <>
            <div onClick={() => setOpen(false)} className="fixed inset-0 z-19" />
            <div className="reader-menu-in absolute top-[calc(100%+8px)] right-0 z-20 w-80 origin-top-right rounded-md border border-[var(--reader-border)] bg-[var(--reader-surface)] p-1.5 shadow-lg">
              <Actions actions={actions} onPick={pick} />
            </div>
          </>
        ) : (
          <BottomSheet title="Start something new" onClose={() => setOpen(false)}>
            <div className="-mx-2.5">
              <Actions actions={actions} onPick={pick} />
            </div>
          </BottomSheet>
        ))}
    </div>
  );
}

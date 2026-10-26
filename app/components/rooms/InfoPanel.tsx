"use client";

import type { ReactNode } from "react";
import { Info, X } from "lucide-react";
import { useShell } from "@/app/components/useShell";
import { SidePanel } from "./RoomScreen";

/** A labelled action in a room's head (its info, a group's Invite). */
export const HEAD_PILL =
  "flex h-8 flex-none cursor-pointer items-center gap-1.5 rounded-sm border border-[var(--reader-border)] bg-transparent px-3 text-ui-caption font-bold whitespace-nowrap text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]";

/** The head's info button (Group info, Book info), as in a WhatsApp group:
 * just "Info" on mobile. */
export function InfoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={HEAD_PILL}>
      <Info size={14} aria-hidden />
      <span className="shell:hidden text-[11.5px]">Info</span>
      <span className="hidden shell:inline text-[11.5px]">{label}</span>
    </button>
  );
}

/** A room's info over it (Group info, Book info, the live room): a panel at
 * the window's right edge when wide, the whole screen on mobile (closed
 * with ✕). It sits in RoomScreen, which is `relative`. */
export default function InfoPanel({ title, onClose, actions, children }: { title: string; onClose: () => void; actions?: ReactNode; children: ReactNode }) {
  const wide = useShell();
  const panel = (
    <aside className={`flex flex-col bg-[var(--reader-bg)] text-[var(--reader-text)] ${wide ? "w-120 flex-none border-l border-[var(--color-app-border)]" : "absolute inset-0 z-10"}`}>
      <div className="flex min-h-14 flex-none items-center gap-1 pr-2 pl-5">
        <span className="flex-1 text-ui-md">{title}</span>
        {actions}
        <button type="button" aria-label="Close" onClick={onClose} className="flex size-11 cursor-pointer items-center justify-center rounded-md hover:bg-[var(--color-app-surface-muted)]">
          <X size={20} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      {children}
    </aside>
  );
  return wide ? <SidePanel>{panel}</SidePanel> : panel;
}

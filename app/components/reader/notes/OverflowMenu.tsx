"use client";

import { Fragment, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

export type OverflowMenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
};

/** Generic scrim + floating menu-item list — the shared positioning
 * primitive behind both a per-entry Edit/Delete/Share menu and the panel
 * header's own Share/Delete menu, so the "fixed inset-0 catches the
 * outside click that closes it" mechanics only live in one place. Opens
 * with a small lift from its corner and focuses the first item; arrows,
 * Home/End move through it, Escape and Tab close it (focus goes back to
 * whatever opened it). Danger items sit under a hairline. */
export default function OverflowMenu({ items, onClose }: { items: OverflowMenuItem[]; onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const menu = menuRef.current;
    menu?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Tab") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Only hand focus back if it was still inside the menu — an item
      // that opened a dialog or moved focus elsewhere keeps it.
      if (!document.activeElement || document.activeElement === document.body || menu?.contains(document.activeElement)) {
        opener?.focus({ preventScroll: true });
      }
    };
  }, [onClose]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    if (buttons.length === 0) return;
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const to =
      e.key === "ArrowDown" ? (at + 1) % buttons.length
      : e.key === "ArrowUp" ? (at - 1 + buttons.length) % buttons.length
      : e.key === "Home" ? 0
      : e.key === "End" ? buttons.length - 1
      : null;
    if (to === null) return;
    e.preventDefault();
    buttons[to].focus();
  };

  // Safe actions first, destructive ones last behind a divider.
  const sorted = [...items.filter((i) => !i.danger), ...items.filter((i) => i.danger)];
  const firstDanger = sorted.findIndex((i) => i.danger);

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-19" />
      <div
        ref={menuRef}
        role="menu"
        onKeyDown={onKeyDown}
        className="reader-menu-in absolute right-0 top-[calc(100%+6px)] z-20 flex min-w-44 origin-top-right flex-col rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)] p-1 shadow-md"
      >
        {sorted.map((item, i) => (
          <Fragment key={item.label}>
            {i === firstDanger && i > 0 && <div role="separator" className="mx-2 my-1 h-px bg-[var(--reader-border)]" />}
            <button
              type="button"
              role="menuitem"
              onClick={item.disabled ? undefined : item.onClick}
              disabled={item.disabled}
              className={`flex h-8 w-full items-center gap-2 rounded-sm border-none bg-transparent px-2.5 text-left text-[12px] font-semibold outline-none transition-colors ${
                item.disabled
                  ? "cursor-not-allowed text-[var(--reader-text-subtle)]"
                  : item.danger
                    ? "cursor-pointer text-[#f26b6b] hover:bg-[#f26b6b]/10 focus-visible:bg-[#f26b6b]/10"
                    : "cursor-pointer text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)] focus-visible:bg-[var(--reader-surface-hover)]"
              }`}
            >
              {item.icon && (
                <span
                  aria-hidden
                  className={`flex w-4 flex-none justify-center ${
                    item.danger || item.disabled ? "" : "text-[var(--reader-text-muted)]"
                  }`}
                >
                  {item.icon}
                </span>
              )}
              <span className="truncate">{item.label}</span>
            </button>
          </Fragment>
        ))}
      </div>
    </>
  );
}

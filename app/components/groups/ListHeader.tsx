"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import OverflowMenu, { type OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";
import { secondaryButton } from "./buttons";

/**
 * The row over a Manage list: what's in it on the left ("4 books"), the
 * tab's one action on the right. An action with `items` opens a menu of
 * them (Add book → From library / Upload); with one item it just runs it.
 */
export default function ListHeader({ count, label, items }: { count: ReactNode; label: string; items: OverflowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const menu = items.length > 1;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--reader-border)] pb-3">
      <span className="text-[13px] font-semibold text-[var(--reader-text-muted)]">{count}</span>
      <div className="relative flex-none">
        <button
          type="button"
          onClick={() => (menu ? setOpen((o) => !o) : items[0]?.onClick())}
          aria-haspopup={menu ? "menu" : undefined}
          aria-expanded={menu ? open : undefined}
          className={secondaryButton}
        >
          <Plus size={15} />
          {label}
        </button>
        {open && (
          <OverflowMenu
            onClose={() => setOpen(false)}
            items={items.map((item) => ({
              ...item,
              onClick: () => {
                setOpen(false);
                item.onClick();
              },
            }))}
          />
        )}
      </div>
    </div>
  );
}

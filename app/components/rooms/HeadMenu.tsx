"use client";

import { useState } from "react";
import { EllipsisVertical } from "lucide-react";
import OverflowMenu, { type OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";

/** The page head's ⋮: the items in a floating menu, closing on a pick. */
export default function HeadMenu({ items }: { items: OverflowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="More"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex size-9 cursor-pointer items-center justify-center rounded-sm text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]"
      >
        <EllipsisVertical size={18} />
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
  );
}

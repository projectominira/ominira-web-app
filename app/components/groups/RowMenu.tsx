"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import OverflowMenu, { type OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";

const ROW_BUTTON =
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent text-[var(--reader-text-muted)] hover:bg-[var(--reader-surface-hover)]";

/** A ⋯ menu (M9 books, M10 members, the group header). Picking an item
 * closes it. */
export default function RowMenu({
  label,
  items,
  disabled,
  buttonClassName = ROW_BUTTON,
}: {
  label: string;
  items: OverflowMenuItem[];
  disabled?: boolean;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const closing = items.map((item) => ({
    ...item,
    onClick: () => {
      setOpen(false);
      item.onClick();
    },
  }));

  return (
    <div className="relative flex-none">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        className={buttonClassName}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && <OverflowMenu onClose={() => setOpen(false)} items={closing} />}
    </div>
  );
}

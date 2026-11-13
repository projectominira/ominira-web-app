"use client";

import { useState } from "react";

/** The rows past the first few, hidden until "Show all": still in the HTML,
 * so every book keeps its link for crawlers (seo-spec T8). */
export default function ShowAll({ total, children }: { total: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={open ? "contents" : "hidden"}>{children}</div>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3.5 h-10 cursor-pointer justify-self-center rounded-sm border border-[var(--color-app-border)] bg-transparent px-[18px] text-[14px] font-semibold text-[var(--color-app-text)] hover:bg-[var(--color-app-surface-muted)] min-[900px]:col-span-2"
        >
          Show all
        </button>
      )}
    </>
  );
}

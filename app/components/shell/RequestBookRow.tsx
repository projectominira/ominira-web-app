"use client";

import { useState } from "react";
import { ChevronRight, Lightbulb } from "lucide-react";
import RequestBookModal from "@/app/components/shared/RequestBookModal";

/** The library's "Suggest a book" card for readers who can't upload
 * — same card as ContributeBookRow, opening RequestBookModal. */
export default function RequestBookRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="mb-8 flex w-full cursor-pointer items-center gap-3.5 rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)] p-5 text-left"
      >
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand-500/10">
          <Lightbulb size={20} className="text-brand-500" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-tight text-[var(--reader-text)]">Suggest a book</span>
          <span className="mt-1 block text-[11px] font-semibold text-[var(--reader-text-muted)]">Title, author or a Google Drive link</span>
        </span>
        <ChevronRight size={18} className="flex-none text-[var(--reader-text-muted)]" />
      </button>
      {open && <RequestBookModal onClose={() => setOpen(false)} />}
    </>
  );
}

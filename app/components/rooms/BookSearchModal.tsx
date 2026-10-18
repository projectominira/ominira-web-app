"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";

export function BookSkeleton() {
  return (
    <div className="flex animate-pulse gap-4 border-b border-[var(--reader-border)] py-4">
      <div className="h-28 w-20 flex-none rounded-xs bg-[var(--reader-surface-hover)]" />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="mb-2 h-3 w-2/3 rounded-full bg-[var(--reader-surface-hover)]" />
        <div className="h-2.5 w-2/5 rounded-full bg-[var(--reader-surface-hover)]" />
      </div>
    </div>
  );
}

/**
 * The book picker's modal (SearchModal's shape): the library's search
 * across the top with the clear X and Cancel (Close on desktop), then
 * `children`: the results while a query is typed, else `idle`. Start a
 * room and a group's reading list both pick a book in it.
 */
export default function BookSearchModal({
  label,
  placeholder,
  query,
  onQuery,
  onClose,
  idle,
  children,
}: {
  label: string;
  placeholder: string;
  query: string;
  onQuery: (q: string) => void;
  onClose: () => void;
  /** Shown before anything is typed. */
  idle: ReactNode;
  /** The results, shown once something is typed. */
  children: ReactNode;
}) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 z-50 box-border flex justify-center bg-black/45 ${isMobile ? "items-stretch p-0" : "items-start px-6 py-16"}`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={`box-border flex w-full flex-col overflow-hidden bg-[var(--reader-surface)] shadow-lg ${isMobile ? "h-full rounded-none" : "h-[640px] max-w-[640px] rounded-lg"}`}
      >
        <div className="flex flex-none items-center gap-2.5 border-b border-[var(--reader-border)] px-5 py-4">
          <Search size={18} className="text-[var(--reader-text-muted)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="flex-1 border-none bg-transparent text-[13px] font-semibold text-[var(--reader-text)] outline-none"
          />
          {query && (
            <button type="button" onClick={() => onQuery("")} aria-label="Clear the search" className="flex cursor-pointer border-none bg-transparent p-0 text-[var(--reader-text-muted)]">
              <X size={16} />
            </button>
          )}
          <button type="button" onClick={onClose} className="cursor-pointer border-none bg-transparent p-0 text-sm font-semibold whitespace-nowrap text-[var(--reader-text-muted)]">
            {isMobile ? "Cancel" : "Close"}
          </button>
        </div>
        <div className="om-scroll flex-1 overflow-y-auto px-5 py-4">{query.trim() !== "" ? children : idle}</div>
      </div>
    </div>
  );
}

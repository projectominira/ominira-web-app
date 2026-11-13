"use client";

import { useEffect, useRef } from "react";
import Link, { useLinkStatus } from "next/link";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

/** Numbered pagination for the quote directory: Previous · Page N · Next.
 * A new page starts from the top, and the clicked button spins while it loads. */
export default function Pager({ page, prev, next }: { page: number; prev: string | null; next: string | null }) {
  // Back to the top when the page changes (not on first load).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [page]);

  return (
    <nav aria-label="Pages" className="flex items-center justify-center gap-3">
      <PageButton href={prev} rel="prev" label="Previous">
        <ChevronLeft size={15} strokeWidth={2.25} aria-hidden />
      </PageButton>
      <span className="min-w-16 text-center text-ui-sm text-[var(--color-app-text-secondary)]" aria-current="page">
        Page {page}
      </span>
      <PageButton href={next} rel="next" label="Next">
        <ChevronRight size={15} strokeWidth={2.25} aria-hidden />
      </PageButton>
    </nav>
  );
}

const BUTTON = "flex h-[42px] items-center gap-1.5 rounded-sm border border-[var(--color-app-border)] px-4 text-[13px] font-bold no-underline";

function PageButton({ href, rel, label, children }: { href: string | null; rel: "prev" | "next"; label: string; children: React.ReactNode }) {
  if (!href)
    return (
      <span aria-disabled className={`${BUTTON} ${rel === "next" ? "flex-row-reverse" : ""} text-[var(--color-app-text-muted)] opacity-50`}>
        {children}
        {label}
      </span>
    );
  return (
    <Link href={href} rel={rel} scroll={false} className={`${BUTTON} ${rel === "next" ? "flex-row-reverse" : ""} text-[var(--color-app-text)] hover:bg-[var(--color-app-surface-muted)]`}>
      <Icon>{children}</Icon>
      {label}
    </Link>
  );
}

/** The arrow, swapped for a spinner while its link loads. */
function Icon({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 size={15} className="animate-spin" aria-label="Loading" /> : <>{children}</>;
}

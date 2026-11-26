"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** A section's tabs under its header (AI, Broadcast), one link each. A tab
 * is current on its own path and below it, unless `exact`. */
export default function AdminTabs({ label, tabs }: { label: string; tabs: { href: string; label: string; exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="mb-6 flex gap-5 overflow-x-auto border-b border-[var(--reader-border)]">
      {tabs.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex-none border-b-2 pb-2.5 text-[13px] font-semibold no-underline transition-colors ${
              active ? "border-brand-500 text-[var(--reader-text)]" : "border-transparent text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

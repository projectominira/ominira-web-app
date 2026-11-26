"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/ai/authors", label: "Authors" },
  { href: "/admin/ai/topics", label: "Topics" },
  { href: "/admin/ai/reading-lists", label: "Reading lists" },
  { href: "/admin/ai/quotes", label: "Quotes" },
  { href: "/admin/ai/connector", label: "Connector" },
];

/** The AI section's tabs: what the AI writes for the site, and the connector it writes through. */
export default function AiTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="AI" className="mb-6 flex gap-5 overflow-x-auto border-b border-[var(--reader-border)]">
      {TABS.map(({ href, label }) => {
        const active = pathname.startsWith(href);
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowUpRight, BookOpen, BookUser, Home, Menu, Mic, Plug, Quote, Send, Users, X } from "lucide-react";
import { SPLASH_MARK } from "@/lib/config/brand-assets";

const NAV = [
  { href: "/admin", label: "Overview", icon: Home },
  { href: "/admin/library", label: "Library", icon: BookOpen },
  { href: "/admin/readers", label: "Readers", icon: BookUser },
  { href: "/admin/groups", label: "Study groups", icon: Users },
  { href: "/admin/rooms", label: "Reading rooms", icon: Mic },
  { href: "/admin/passage", label: "Passages", icon: Quote },
  { href: "/admin/push", label: "Broadcast", icon: Send },
  { href: "/admin/connector", label: "Connector", icon: Plug },
];

function Mark({ className }: { className: string }) {
  return (["light", "dark"] as const).map((theme) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={theme} src={SPLASH_MARK[theme]} alt="" aria-hidden="true" className={`theme-${theme}-only w-auto flex-none object-contain ${className}`} />
  ));
}

function Nav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Admin" className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-10 items-center gap-2.5 rounded-sm px-2.5 text-[14px] font-semibold no-underline ${
              active ? "bg-brand-500/10 text-brand-500" : "text-[var(--reader-text-muted)] hover:bg-[var(--reader-surface-hover)] hover:text-[var(--reader-text)]"
            }`}
          >
            <Icon size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function OpenApp() {
  return (
    <Link href="/home" className="mt-auto flex h-10 items-center gap-2.5 rounded-sm px-2.5 text-[13px] font-semibold text-[var(--reader-text-subtle)] no-underline hover:text-[var(--reader-text)]">
      <ArrowUpRight size={16} />
      Open Ominira
    </Link>
  );
}

/** Admin chrome: a sidebar on desktop, a top bar with a menu drawer on
 * mobile. The PIN unlock screen goes without it. */
export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The drawer remembers the page it was opened on, so following a link closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);

  if (pathname.startsWith("/admin/unlock")) return <main className="mx-auto w-full px-5 py-8 shell:px-10">{children}</main>;

  const brand = (
    <div className="flex items-center gap-2.5 px-2">
      <Mark className="h-7" />
      <span className="text-[16px] font-bold text-[var(--reader-text)]">Ominira</span>
      <span className="rounded-sm border border-[var(--reader-border)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--reader-text-muted)]">Admin</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--reader-bg)]">
      <aside className="fixed inset-y-0 left-0 hidden w-[232px] flex-col gap-6 border-r border-[var(--reader-border)] bg-[var(--reader-bg)] px-3 py-5 shell:flex">
        {brand}
        <Nav pathname={pathname} />
        <OpenApp />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[var(--reader-border)] bg-[var(--reader-bg)] px-2 shell:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open admin menu"
          className="flex h-11 w-11 cursor-pointer items-center justify-center border-none bg-transparent text-[var(--reader-text)]"
        >
          <Menu size={22} />
        </button>
        <Mark className="h-6" />
        <span className="text-[15px] font-bold text-[var(--reader-text)]">Admin</span>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 shell:hidden">
          <button type="button" aria-label="Close admin menu" onClick={() => setOpen(false)} className="absolute inset-0 cursor-default border-none bg-black/40" />
          <div className="absolute inset-y-0 left-0 flex w-[264px] flex-col gap-6 bg-[var(--reader-bg)] px-3 py-5 shadow-lg">
            <div className="flex items-center justify-between">
              {brand}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close admin menu"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent text-[var(--reader-text-muted)]"
              >
                <X size={18} />
              </button>
            </div>
            <Nav pathname={pathname} />
            <OpenApp />
          </div>
        </div>
      )}

      {/* Same content width as the app's own shell (AppShell). An open side
          panel (AdminSidePanel) pins the column to its left edge on wide screens. */}
      <main className="w-full shell:pl-[232px]">
        <div className="mx-auto max-w-5xl px-5 py-5 shell:px-10 shell:pt-8 xl:has-[[data-side-panel]]:mr-[440px]">{children}</div>
      </main>
    </div>
  );
}

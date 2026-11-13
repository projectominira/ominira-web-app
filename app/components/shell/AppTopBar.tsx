"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Menu, Search } from "lucide-react";
import { BROWSE_ITEMS, NAV_ITEMS, isNavItemActive } from "./navItems";
import BrandMark from "./BrandMark";
import NotificationsMenu from "./NotificationsMenu";
import ProfileMenu from "./ProfileMenu";
import HeaderThemeToggle from "./HeaderThemeToggle";
import SearchModal from "@/app/components/SearchModal";
import { useReaderOverlayStore } from "@/stores/reader-overlay-store";
import { useIsAuthenticated } from "@/lib/auth/useIsAuthenticated";
import { useSessionStore } from "@/stores/session-store";

const LINK =
  "flex h-9 items-center rounded-sm px-3 text-[14px] font-semibold no-underline transition-colors";
const linkTone = (active: boolean) =>
  active
    ? "text-[var(--reader-accent)]"
    : "text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]";

/**
 * The header: brand, Home, Shelf, Browse ▾ (every catalogue page), the
 * library search, then the reader's bell and avatar. On a phone only
 * visitors get it (brand, Log in, Join us, and a menu with search and the rest);
 * signed-in readers keep AppBottomNav and AppHeader there instead.
 *
 * `landing`: the same header at the top of the landing page, in the page's
 * flow (not fixed) and on the hero's dark ground. The dark theme's tokens
 * are scoped to it, so its text and borders suit that ground in either theme.
 */
export default function AppTopBar({ landing = false }: { landing?: boolean }) {
  const pathname = usePathname();
  const overlayOpen = useReaderOverlayStore((s) => s.open);
  const isAuthenticated = useIsAuthenticated();
  const sessionKnown = useSessionStore((s) => s.hasHydrated);
  const [searchOpen, setSearchOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);

  // Leaving ReaderModal by a soft navigation can leave Next's intercepted
  // route state stale (the next reader deep link then fails silently), so
  // while it's open the header navigates with a full page load.
  const onNavClick = overlayOpen
    ? (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        window.location.href = e.currentTarget.href;
      }
    : undefined;

  // Shelf is a reader's own; a visitor gets Library in its place (and
  // Browse drops it, so it isn't listed twice).
  const second = isAuthenticated ? "/shelf" : "/library";
  const top = NAV_ITEMS.filter((i) => i.href === "/home" || i.href === second);
  const browse = isAuthenticated
    ? BROWSE_ITEMS
    : BROWSE_ITEMS.filter((i) => i.href !== "/library");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuLink = (href: string) =>
    `flex rounded-sm px-2.5 py-2.5 text-[13px] font-semibold no-underline hover:bg-[var(--reader-surface-hover)] ${
      isNavItemActive(pathname, href)
        ? "text-[var(--reader-accent)]"
        : "text-[var(--reader-text)]"
    }`;

  return (
    <>
      <header
        id={landing ? "landing-header" : undefined}
        data-reader-theme={landing ? "dark" : undefined}
        // The landing's Join us keeps the page's own brand orange (dark's accent is paler).
      style={{ paddingTop: "env(safe-area-inset-top)", ...(landing && { ["--reader-accent" as string]: "var(--color-brand-500)" }) }}
        className={`box-content h-[var(--app-topbar-h)] border-b select-none no-callout ${
          landing
            ? "relative border-white/8 bg-[var(--landing-ink)]"
            : `fixed inset-x-0 top-0 z-40 ${isAuthenticated ? "hidden shell:block" : "block"} border-[var(--reader-border)] bg-[var(--reader-surface)]`
        }`}
      >
        <div className="mx-auto flex h-full max-w-7xl items-center gap-4 px-5 shell:gap-6 shell:px-10 min-[1024px]:gap-8">
          <Link
            href={landing ? "/" : "/home"}
            onClick={onNavClick}
            aria-label="Ominira home"
            className="flex-none no-underline"
          >
            <BrandMark withMark tagline="Arise for Freedom" />
          </Link>

          <nav className="hidden flex-none items-center shell:flex">
            {top.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={onNavClick}
                className={`${LINK} ${linkTone(isNavItemActive(pathname, href))}`}
              >
                {label}
              </Link>
            ))}
            <Popover.Root open={browseOpen} onOpenChange={setBrowseOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={`${LINK} cursor-pointer gap-1 border-none bg-transparent ${linkTone(false)}`}
                >
                  Browse
                  <ChevronDown size={15} />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  align="start"
                  sideOffset={10}
                  className="z-50 w-48 rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)] p-1.5 shadow-lg"
                >
                  {browse.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={(e) => {
                        setBrowseOpen(false);
                        onNavClick?.(e);
                      }}
                      className={menuLink(href)}
                    >
                      {label}
                    </Link>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </nav>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className={`hidden h-10 min-w-40 max-w-sm flex-1 cursor-pointer items-center gap-2 shell:flex rounded-sm border border-[var(--reader-border)] ${landing ? "bg-[var(--landing-ink)]" : "bg-[var(--reader-bg)]"} px-3.5 text-left text-[13px] font-semibold text-[var(--reader-text-subtle)]`}
          >
            <Search
              size={16}
              className="flex-none text-[var(--reader-text-muted)]"
            />
            <span className="truncate">Search the library</span>
          </button>

          <div className="ml-auto flex flex-none items-center gap-3 shell:gap-5">
            {isAuthenticated ? (
              <>
                <NotificationsMenu />
                <ProfileMenu />
              </>
            ) : (
              sessionKnown && (
                <>
                  <span className="hidden shell:flex">
                    <HeaderThemeToggle />
                  </span>
                  <Link
                    href="/auth/login"
                    onClick={onNavClick}
                    className="text-[14px] font-semibold text-[var(--reader-text-muted)] no-underline hover:text-[var(--reader-text)]"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/auth/signup"
                    onClick={onNavClick}
                    className="flex h-9 items-center rounded-sm bg-[var(--reader-accent)] px-3 text-[13px] shell:px-3.5 font-bold text-white no-underline hover:opacity-90"
                  >
                    Join us
                  </Link>
                  <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        aria-label="Menu"
                        className="flex flex-none cursor-pointer items-center border-none bg-transparent p-0 text-[var(--reader-text-muted)] hover:text-[var(--reader-text)] shell:hidden"
                      >
                        <Menu size={22} />
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        align="end"
                        sideOffset={18}
                        className="z-50 w-56 rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)] p-1.5 shadow-lg"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            setSearchOpen(true);
                          }}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-sm border-none bg-transparent px-2.5 py-2.5 text-left text-[13px] font-semibold text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]"
                        >
                          <Search
                            size={16}
                            className="text-[var(--reader-text-muted)]"
                          />
                          Search the library
                        </button>
                        <hr className="mx-2.5 my-1.5 h-px border-0 bg-[var(--reader-border)]" />
                        {[...top, ...browse].map(({ href, label }) => (
                          <Link
                            key={href}
                            href={href}
                            onClick={(e) => {
                              setMenuOpen(false);
                              onNavClick?.(e);
                            }}
                            className={menuLink(href)}
                          >
                            {label}
                          </Link>
                        ))}
                        <hr className="mx-2.5 my-1.5 h-px border-0 bg-[var(--reader-border)]" />
                        <div className="flex px-2.5 py-2.5">
                          <HeaderThemeToggle withLabel />
                        </div>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                </>
              )
            )}
          </div>
        </div>
      </header>

      {/* Outside <header>, so the landing's scoped dark theme stays off it. */}
      {searchOpen && (
        <div className="fixed inset-0 z-50">
          <SearchModal onClose={() => setSearchOpen(false)} />
        </div>
      )}
    </>
  );
}

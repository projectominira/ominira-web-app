"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import DetailHeader from "@/app/components/shared/DetailHeader";
import UnderlineTabs from "@/app/components/UnderlineTabs";
import { useDockedHeight } from "@/app/components/useBottomDock";
import { useLayoutStore } from "@/stores/layout-store";

const SideSlot = createContext<HTMLElement | null>(null);

/** Puts a room's side panel in the screen's right edge, outside the centred
 * column, so it opens at the window's edge rather than inside the column. */
export function SidePanel({ children }: { children: ReactNode }) {
  const slot = useContext(SideSlot);
  return slot ? createPortal(children, slot) : <>{children}</>;
}

/** A room's page (a book's, a study group's): a screen of its own, over the
 * bottom nav on mobile and beside the sidebar on desktop, at the app
 * shell's width. A player docked below keeps the nav under it, and the
 * screen stops above both. Its head is `ScreenHead`; each tab fills the rest. */
export default function RoomScreen({
  children,
  sidebar = true,
  scroll = false,
}: {
  children: ReactNode;
  /** false: the screen spans the whole window on desktop (a study group). */
  sidebar?: boolean;
  /** The screen itself scrolls, so its scrollbar sits at the window's edge (a page of forms and lists). */
  scroll?: boolean;
}) {
  const docked = useDockedHeight();
  const navHeight = useLayoutStore((s) => s.bottomNavHeight);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <div
      style={{ bottom: docked ? navHeight + docked : 0, paddingTop: "env(safe-area-inset-top)" }}
      className={`fixed inset-x-0 top-0 z-[41] flex bg-[var(--reader-bg)] ${scroll ? "om-scroll overflow-y-auto overscroll-y-contain" : ""} ${sidebar ? "shell:left-[var(--app-sidebar-w)]" : ""}`}
    >
      <div className="min-w-0 flex-1 shell:px-10">
        <div className={`mx-auto flex w-full max-w-4xl ${scroll ? "min-h-full" : "h-full"} flex-col text-[var(--color-app-text)]`}>
          <SideSlot.Provider value={slot}>{children}</SideSlot.Provider>
        </div>
      </div>
      <div ref={setSlot} className="flex flex-none empty:hidden" />
    </div>
  );
}

/** Back, share and the page's own action, over the page's tabs. */
export function ScreenHead<T extends string>({
  title,
  onBack,
  share,
  action,
  actionLast,
  onTitle,
  lead,
  subtitle,
  tabs,
  tab,
  onTab,
}: {
  title?: string;
  onBack: () => void;
  share: { title: string; text?: string };
  action?: ReactNode;
  actionLast?: boolean;
  onTitle?: () => void;
  lead?: ReactNode;
  subtitle?: string;
  /** A page with one view has no tabs. */
  tabs?: { value: T; label: ReactNode }[];
  tab?: T;
  onTab?: (tab: T) => void;
}) {
  return (
    <div className="flex-none border-b border-[var(--reader-border)] px-4 shell:px-0">
      <DetailHeader title={title} onBack={onBack} shareAction={share} action={action} actionLast={actionLast} onTitle={onTitle} lead={lead} subtitle={subtitle} />
      {tabs && tab !== undefined && onTab && <UnderlineTabs bare options={tabs} value={tab} onChange={onTab} />}
    </div>
  );
}

/** A tab that scrolls as a page: one centred column. */
export function ScreenPage({ children, outer = false }: { children: ReactNode; /** The screen itself scrolls (`RoomScreen scroll`), so the page doesn't. */ outer?: boolean }) {
  const column = <div className="mx-auto flex w-full max-w-[640px] flex-col px-4 pt-6 pb-12">{children}</div>;
  return outer ? column : <div className="om-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain">{column}</div>;
}

/** Switches the page's tab in the URL too (`?tab=`), so a refresh or a
 * shared link lands on it; without a navigation. */
export function replaceTabParam(tab: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  window.history.replaceState(window.history.state, "", url);
}

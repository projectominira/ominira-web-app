"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import DetailHeader from "@/app/components/shared/DetailHeader";
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
 * screen stops above both. Its head is `ScreenHead`; the room fills the rest. */
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
        <div className={`relative mx-auto flex w-full max-w-4xl ${scroll ? "min-h-full" : "h-full"} flex-col text-[var(--color-app-text)]`}>
          <SideSlot.Provider value={slot}>{children}</SideSlot.Provider>
        </div>
      </div>
      <div ref={setSlot} className="flex flex-none empty:hidden" />
    </div>
  );
}

/** Back, the room's name, share and the page's own actions. */
export function ScreenHead({
  title,
  onBack,
  share,
  action,
  actionLast,
  onTitle,
  lead,
  subtitle,
}: {
  title?: string;
  onBack: () => void;
  /** Left out where the room's info has it (a book's). */
  share?: { title: string; text?: string };
  action?: ReactNode;
  actionLast?: boolean;
  onTitle?: () => void;
  lead?: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="flex-none border-b border-[var(--reader-border)] px-4 shell:px-0">
      <DetailHeader title={title} onBack={onBack} shareAction={share} action={action} actionLast={actionLast} onTitle={onTitle} lead={lead} subtitle={subtitle} />
    </div>
  );
}

/** A page that scrolls: one centred column. */
export function ScreenPage({ children, outer = false }: { children: ReactNode; /** The screen itself scrolls (`RoomScreen scroll`), so the page doesn't. */ outer?: boolean }) {
  const column = <div className="mx-auto flex w-full max-w-[640px] flex-col px-4 pt-6 pb-12">{children}</div>;
  return outer ? column : <div className="om-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain">{column}</div>;
}

/** Sets the page's `?tab=` (a book's room or its info) without a
 * navigation, so a refresh or a shared link lands on it. */
export function replaceTabParam(tab: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  window.history.replaceState(window.history.state, "", url);
}

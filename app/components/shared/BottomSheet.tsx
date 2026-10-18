"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useReaderStore } from "@/stores/reader-store";

/**
 * The sheet shell (studygroup-spec component 7.3): a bottom sheet with a
 * handle and a serif title on mobile, a centered card on desktop, over a
 * dimmed backdrop. Escape and the backdrop close it. Pinned to the app's
 * theme like ConfirmDialog. The date picker and the group's moderator sheets
 * compose it. `bare` keeps the backdrop, Escape and placement but leaves the
 * surface to the children: a room's sheet brings its own (RoomPanel).
 * `contained` sits over its nearest positioned parent instead of the page
 * (a room is its own screen, and the gallery renders rooms in frames).
 */
export default function BottomSheet({
  title,
  onClose,
  children,
  footer,
  bare = false,
  contained = false,
}: {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Pinned under the scrolling body: the sheet's one action. */
  footer?: ReactNode;
  bare?: boolean;
  contained?: boolean;
}) {
  const theme = useReaderStore((s) => s.theme);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  const sheet = (
    <div
      data-reader-theme={theme}
      onClick={onClose}
      className={
        contained
          ? "absolute inset-0 z-30 flex items-end justify-center bg-black/45"
          : "fixed inset-0 z-[120] flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
      }
    >
      {bare ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className={`reader-menu-in flex w-full flex-col ${contained ? "max-h-full" : "max-h-[92dvh] sm:max-w-[420px]"}`}
        >
          {children}
        </div>
      ) : (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="reader-menu-in flex max-h-[90dvh] w-full flex-col rounded-t-[24px] bg-[var(--reader-surface)] shadow-lg sm:max-w-[420px] sm:rounded-lg"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-9 flex-none rounded-full bg-[var(--reader-border)] sm:hidden" />
          <h2 className="m-0 flex-none px-5 pt-4 pb-3 font-serif text-lg font-semibold text-[var(--reader-text)]">{title}</h2>
          <div className="om-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pb-5">{children}</div>
          {footer && <div className="flex-none border-t border-[var(--reader-border)] px-5 py-3">{footer}</div>}
        </div>
      )}
    </div>
  );
  return contained ? sheet : createPortal(sheet, document.body);
}

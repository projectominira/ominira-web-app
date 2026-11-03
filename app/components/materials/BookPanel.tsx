"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { MaterialDetail } from "@/lib/materials/detail";
import { useDockedHeight } from "@/app/components/useBottomDock";
import { BookActions, BookBody } from "./BookPage";

/**
 * Book info in a panel over the page you clicked it on (library, shelf,
 * home, landing): the @modal slot's intercept of /library/[slug]. Right
 * edge on desktop, a sheet on mobile. Closing is a history pop, so the
 * page behind keeps its scroll; a shared or typed link still gets the full
 * BookPage. Like DocumentOverlayShell, it hides itself once the path moves
 * on, since the slot doesn't always swap back to its default. Without a
 * material it's the route's loading state: the spinner in the panel, and
 * the panel's entrance, which the loaded one doesn't repeat.
 */
export default function BookPanel({ material = null }: { material?: MaterialDetail | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const open = material ? pathname === `/library/${material.slug}` : pathname.startsWith("/library/");
  const docked = useDockedHeight();
  const close = useCallback(() => (window.history.length > 1 ? router.back() : router.push("/library")), [router]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[42] flex items-end shell:items-stretch shell:justify-end" style={{ paddingBottom: docked }}>
      <div aria-hidden onClick={close} className={`absolute inset-0 ${material ? "bg-black/35" : "reader-modal-scrim-enter"}`} />
      <aside
        role="dialog"
        aria-modal
        aria-label={material?.title ?? "Book"}
        className={`${material ? "" : "book-panel"} relative flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-lg bg-[var(--reader-bg)] text-[var(--color-app-text)] shadow-lg shell:h-full shell:w-[480px] shell:rounded-none shell:border-l shell:border-[var(--reader-border)]`}
      >
        <div className="flex h-14 flex-none items-center justify-between border-b border-[var(--reader-border)] px-4">
          <button type="button" onClick={close} aria-label="Close" className="-ml-1 flex cursor-pointer border-none bg-transparent p-1 text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]">
            <X size={20} />
          </button>
          {material && <BookActions material={material} />}
        </div>
        {material ? (
          <BookBody material={material} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div role="status" aria-label="Loading" className="size-7 animate-spin rounded-full border-[2.5px] border-sand-200 border-t-brand-500" />
          </div>
        )}
      </aside>
    </div>
  );
}

"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GUTTER } from "./styles";

/**
 * A category shelf, on a light or dark band: its name and a line, arrows
 * to scroll it (or swipe), and its covers (`children`, rendered on the
 * server) in a row that scrolls sideways — the page itself never does.
 */
export default function Shelf({ title, line, href, dark = false, children }: { title: string; line: string; href: string; dark?: boolean; children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.8, behavior: "smooth" });
  const arrow = `flex size-10 cursor-pointer items-center justify-center rounded-full border bg-transparent p-0 text-current ${dark ? "border-white/16" : "border-[var(--color-app-border)]"}`;
  return (
    <section className={dark ? "border-y border-[var(--landing-edge)] bg-[var(--landing-ink)] py-8 text-sand-25 md:py-[clamp(40px,4.4vw,72px)]" : "py-8 md:py-[clamp(40px,4.4vw,72px)]"}>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3.5 md:gap-5">
        <div className={`flex items-end justify-between gap-4 ${GUTTER}`}>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3.5 gap-y-1">
            <h3 className="m-0 font-serif text-[20px]/[1.25] font-semibold md:text-display-sm">
              <Link href={href} className="text-current no-underline hover:underline">
                {title}
              </Link>
            </h3>
            <span className={`text-ui-caption md:text-ui-sm ${dark ? "text-sand-25/68" : "text-[var(--color-app-text-secondary)]"}`}>{line}</span>
          </div>
          {/* Arrows from md up; a phone swipes. */}
          <div className="hidden flex-none gap-2 md:flex">
            <button type="button" aria-label="Scroll left" onClick={() => scroll(-1)} className={arrow}>
              <ChevronLeft size={18} />
            </button>
            <button type="button" aria-label="Scroll right" onClick={() => scroll(1)} className={arrow}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div ref={row} className={`flex snap-x snap-proximity gap-3.5 overflow-x-auto py-2 [scrollbar-width:none] md:gap-[clamp(14px,1.6vw,24px)] ${GUTTER} scroll-px-5 md:scroll-px-[clamp(20px,4vw,56px)]`}>
          {children}
        </div>
      </div>
    </section>
  );
}

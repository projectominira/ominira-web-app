"use client";

import { useRouter } from "next/navigation";
import { readerHref } from "@/app/components/ReaderLink";
import { buildResumeHref, positionPercent } from "@/lib/reader/locator";
import { useServerPositionReady } from "@/lib/reader/useServerPositionReady";
import { bookCta, type BookProgress } from "@/lib/rooms/book";
import { useReadingPositionStore } from "@/stores/reading-position-store";

/** A book's two reading actions (ResumeButtons): resume in the mode last
 * used, or switch to the other, from your saved position, and how much is
 * done (ReadingProgress; null until started). `ready` gates them on the
 * server's position (see useServerPositionReady). */
export function useResume(book: { id: string; slug: string } | null) {
  const router = useRouter();
  const ready = useServerPositionReady();
  const position = useReadingPositionStore((s) => (book ? s.positions[book.id] : undefined));
  // positionPercent: a full bar means the reader marked it finished.
  const progress: BookProgress = position ? { pct: positionPercent(position), finished: !!position.finishedAt, listening: position.mode === "listen" } : null;
  const listening = !!progress?.listening;
  const go = (mode: "read" | "listen") =>
    book && router.push(readerHref(position ? buildResumeHref(book.slug, { ...position, mode }) : `/read/${book.slug}${mode === "listen" ? "?listen=1" : ""}`));
  const started = progress && (progress.finished || progress.pct > 0) ? progress : null;
  return {
    ready,
    pct: started && (started.finished ? 100 : Math.round(started.pct)),
    cta: bookCta(progress),
    listening,
    onContinue: () => go(listening ? "listen" : "read"),
    onSwitch: () => go(listening ? "read" : "listen"),
  };
}

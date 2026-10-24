"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Download, Share, X } from "lucide-react";
import { domToBlob } from "modern-screenshot";
import { PLATFORM_HOST, PLATFORM_NAME } from "@/lib/config/platform";
import { SPLASH_MARK, WORDMARK } from "@/lib/config/brand-assets";

type Props = {
  quote: string;
  author?: string;
  bookTitle: string;
  onClose: () => void;
};

/** Strips a trailing "; " left over from multi-author source metadata that
 * only ever resolved to one name here (e.g. "Cedric J. Robinson;") — purely
 * a display cleanup for this card, not a fix to the underlying data, so it
 * doesn't touch how the author renders anywhere else in the app. */
function cleanAuthor(author: string): string {
  return author.replace(/[;,\s]+$/, "");
}

const EXPORT_FILENAME = "ominira-quote.png";

// Instagram's own standard square upload size — every export is
// rasterized at this resolution.
const EXPORT_SIZE = 1080;

// The card is always laid out at this fixed CSS size, on every device, and
// only visually scaled down to fit a smaller screen — so the quote wraps and
// clamps identically (and the exported PNG is identical) on phone and desktop.
const CARD_SIZE = 640;

/** Starting type for a quote of this length: short quotes read big, long ones
 * smaller. fitQuote only ever shrinks from here, down to MIN_QUOTE_PX. */
function quoteType(length: number): { size: number; leading: number } {
  if (length <= 140) return { size: 36, leading: 1.35 };
  if (length <= 320) return { size: 25, leading: 1.5 };
  if (length <= 560) return { size: 19.5, leading: 1.6 };
  return { size: 17.5, leading: 1.6 };
}

const MIN_QUOTE_PX = 15;

/** Shrinks the quote until its block fits the space above the footer, and
 * only clamps (to the lines that fit) if it still overflows at MIN_QUOTE_PX.
 * Runs on the fixed CARD_SIZE layout, so the result is the same on every
 * device and in the export. */
function fitQuote(space: HTMLElement, block: HTMLElement, text: HTMLElement, length: number) {
  const { size, leading } = quoteType(length);
  let px = size;
  text.style.lineHeight = String(leading);
  text.style.webkitLineClamp = "none";
  text.style.fontSize = `${px}px`;
  while (px > MIN_QUOTE_PX && block.offsetHeight > space.clientHeight) {
    px -= 0.5;
    text.style.fontSize = `${px}px`;
  }
  const over = block.offsetHeight - space.clientHeight;
  if (over > 0) {
    text.style.webkitLineClamp = String(Math.max(1, Math.floor((text.offsetHeight - over) / (px * leading))));
  }
}

async function renderBlob(node: HTMLElement): Promise<Blob> {
  // Explicit size: left out, modern-screenshot measures getBoundingClientRect,
  // which includes the on-screen fit scale on narrow screens and crops the
  // full-size render to that smaller box.
  return domToBlob(node, {
    width: CARD_SIZE,
    height: CARD_SIZE,
    scale: EXPORT_SIZE / CARD_SIZE,
    backgroundColor: getComputedStyle(node).backgroundColor,
  });
}


export default function ShareQuoteModal({ quote, author, bookTitle, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const spaceRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const quoteRef = useRef<HTMLParagraphElement>(null);
  const [fit, setFit] = useState(1);

  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [isMobile, setIsMobile] = useState(false);
 
  const [canShareFiles] = useState(
    () =>
      typeof navigator.share === "function" &&
      navigator.canShare?.({ files: [new File([], EXPORT_FILENAME, { type: "image/png" })] }) === true
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useLayoutEffect(() => {
    const fitNow = () => {
      if (spaceRef.current && blockRef.current && quoteRef.current) {
        fitQuote(spaceRef.current, blockRef.current, quoteRef.current, quote.length);
      }
    };
    fitNow();
    // Again once the web fonts are in, since fallback metrics differ.
    let live = true;
    document.fonts.ready.then(() => live && fitNow());
    return () => {
      live = false;
    };
  }, [quote, author, bookTitle]);

  // Scale the fixed-size card down to the square's on-screen width.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(([entry]) => setFit(entry.contentRect.width / CARD_SIZE));
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  const onDownload = async () => {
    if (!cardRef.current || busy) return;
    setBusy("download");
    try {
      const blob = await renderBlob(cardRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = EXPORT_FILENAME;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  };

  const onShare = async () => {
    if (!cardRef.current || busy) return;
    setBusy("share");
    try {
      const blob = await renderBlob(cardRef.current);
      const file = new File([blob], EXPORT_FILENAME, { type: "image/png" });
      await navigator.share({ files: [file] });
    } catch {
      // Reader dismissed the native share sheet — not an error.
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      onClick={onClose}
      className={`w-full h-full box-border bg-black/45 flex justify-center ${
        isMobile ? "items-stretch p-0" : "items-center py-10 px-6"
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full bg-[var(--reader-surface)] shadow-lg flex flex-col box-border overflow-hidden ${
          isMobile ? "h-full rounded-none" : "max-w-[860px] max-h-[90vh] rounded-lg"
        }`}
      >
        <div className="flex flex-none items-center justify-between border-b border-[var(--reader-border)] px-4 py-3.5">
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex cursor-pointer items-center justify-center border-none bg-transparent text-[var(--reader-text)]"
          >
            <X size={20} />
          </button>
          <span className="text-sm font-bold text-[var(--reader-text)]">Share</span>
          <div className="flex items-center gap-4">
            <button
              onClick={onDownload}
              disabled={busy !== null}
              aria-label="Download image"
              className="flex cursor-pointer items-center justify-center border-none bg-transparent text-[var(--reader-text)] disabled:cursor-default disabled:opacity-40"
            >
              <Download size={20} />
            </button>
            {canShareFiles && (
              <button
                onClick={onShare}
                disabled={busy !== null}
                aria-label="Share image"
                className="flex cursor-pointer items-center justify-center border-none bg-transparent text-[var(--reader-text)] disabled:cursor-default disabled:opacity-40"
              >
                <Share size={20} />
              </button>
            )}
          </div>
        </div>

        {/* The square takes whatever room the dialog gives it (up to
            CARD_SIZE); the card inside keeps its CARD_SIZE layout and is just
            scaled to the square. The transform sits on a wrapper, not the
            card, so the export (which clones only the card) is unscaled. */}
        <div className="flex flex-1 items-center justify-center overflow-hidden p-2 md:p-4">
          <div ref={stageRef} className="aspect-square w-full flex-none overflow-hidden" style={{ maxWidth: CARD_SIZE }}>
            <div
              style={{ width: CARD_SIZE, height: CARD_SIZE, transform: `scale(${fit})`, transformOrigin: "top left" }}
            >
              <div
                ref={cardRef}
                style={{ background: "var(--color-sand-50)", width: CARD_SIZE, height: CARD_SIZE }}
                className="relative flex flex-col overflow-hidden px-14 pt-12 pb-10 text-left"
              >
                {/* The space above the footer; the quote block centres in it
                    (my-auto, which collapses to 0 rather than overflowing
                    upward when the block is too tall — see fitQuote). */}
                <div ref={spaceRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div ref={blockRef} className="my-auto flex-none">
                    {/* leading-none keeps the glyph's ink (≈11–32px down a
                        96px line) inside this 36px box, so the space's
                        overflow-hidden can't clip it; only the glyph's empty
                        lower line hangs below. */}
                    <span
                      aria-hidden="true"
                      className="mb-3 block h-9 select-none font-serif text-[96px] leading-none text-[var(--color-brand-300)]"
                    >
                      &ldquo;
                    </span>
                    <p
                      ref={quoteRef}
                      style={{ fontSize: quoteType(quote.length).size, lineHeight: quoteType(quote.length).leading }}
                      className="m-0 overflow-hidden font-serif tracking-[-0.005em] text-[var(--color-sand-900)] [-webkit-box-orient:vertical] [display:-webkit-box]"
                    >
                      {quote}
                    </p>
                    {/* One quiet line, wrapping to at most two, so a long
                        title or a missing author never reshapes the card. */}
                    <p className="m-0 mt-6 line-clamp-2 font-sans text-[15px] leading-[1.5] text-[var(--color-sand-600)]">
                      &mdash;{" "}
                      {author && (
                        <>
                          <span className="font-semibold text-[var(--color-sand-800)]">{cleanAuthor(author)}</span>,{" "}
                        </>
                      )}
                      {bookTitle}
                    </p>
                  </div>
                </div>

                <div className="mt-7 flex flex-none flex-col items-start gap-2.5">
                  <div className="flex items-center gap-3">
                    <img src={SPLASH_MARK.light} alt="" width={41} height={40} className="h-10 w-auto" />
                    <img src={WORDMARK.light} alt={PLATFORM_NAME} width={147} height={22} className="h-[22px] w-auto" />
                  </div>
                  <span className="font-sans text-[13px] font-semibold uppercase tracking-[0.2em] text-[var(--color-sand-600)]">
                    {PLATFORM_HOST}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The quote card, for the selection menu's Share, the notes panel's and
 * /admin/passage's Export image — `share(quote)` opens it; render `modal`
 * once anywhere (it's fixed). */
export function useShareQuote(title: string, author?: string): { share: (quote: string) => void; modal: ReactNode } {
  const [quote, setQuote] = useState<string | null>(null);
  return {
    share: setQuote,
    modal:
      quote !== null ? (
        <div className="fixed inset-0 z-[80]">
          <ShareQuoteModal quote={quote} author={author} bookTitle={title} onClose={() => setQuote(null)} />
        </div>
      ) : null,
  };
}

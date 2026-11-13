import { SPLASH_MARK, WORDMARK } from "@/lib/config/brand-assets";

type Props = {
  className?: string;
  /** Show the Ominira mark before the wordmark (the desktop header). */
  withMark?: boolean;
  /** Mark above the wordmark, both centred, instead of side by side. */
  stacked?: boolean;
  /** A line under the wordmark (the desktop header's "Arise for Freedom"). */
  tagline?: string;
};

/** Shared product signature for shell chrome and compact scroll headers. */
export default function BrandMark({ className, withMark = false, stacked = false, tagline }: Props) {
  return (
    <span className={`flex ${stacked ? "flex-col items-center gap-1.5" : "items-end gap-2.5"} ${className ?? ""}`}>
      {withMark &&
        // Transparent mark straight on the header, in both theme variants —
        // <html>'s data-reader-theme hides the other (.theme-*-only,
        // globals.css), so it's right on first paint with no swap.
        (["light", "dark"] as const).map((theme) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={theme}
            src={SPLASH_MARK[theme]}
            alt=""
            aria-hidden="true"
            width={480}
            height={467}
            className={`theme-${theme}-only ${tagline ? "h-11" : "h-13"} w-auto flex-none`}
          />
        ))}
      {/* Side by side it's bottom-anchored, not centered: the mark is
          optically bottom-heavy (thin rays above, the book below), so the
          wordmark sits level with the book. */}
      {(() => {
        const wordmark = (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={WORDMARK}
            alt="Ominira"
            width={108}
            height={18}
            className={`${withMark && !stacked && !tagline ? "mb-1.5" : ""} h-[18px] w-auto flex-none`}
          />
        );
        return tagline ? (
          <span className="flex flex-col gap-1.5">
            {wordmark}
            <span className="text-[12px]/none font-semibold tracking-[0.01em] whitespace-nowrap text-[var(--reader-text-muted)]">{tagline}</span>
          </span>
        ) : (
          wordmark
        );
      })()}
    </span>
  );
}

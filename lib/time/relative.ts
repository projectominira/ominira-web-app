const RELATIVE_TIME_UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: "year", ms: 1000 * 60 * 60 * 24 * 365 },
  { unit: "month", ms: 1000 * 60 * 60 * 24 * 30 },
  { unit: "week", ms: 1000 * 60 * 60 * 24 * 7 },
  { unit: "day", ms: 1000 * 60 * 60 * 24 },
  { unit: "hour", ms: 1000 * 60 * 60 },
  { unit: "minute", ms: 1000 * 60 },
];

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Full relative time ("6 hours ago", "Just now") via the native
 * `Intl.RelativeTimeFormat` — no date library needed for this; the only
 * handcrafted part is picking which unit to hand it, since Intl doesn't
 * auto-select one. */
export function formatTimeAgo(savedAt: number, now: number = Date.now()): string {
  const diffMs = savedAt - now;
  const absDiffMs = Math.abs(diffMs);

  if (absDiffMs < 1000 * 60) return "Just now";

  for (const { unit, ms } of RELATIVE_TIME_UNITS) {
    if (absDiffMs >= ms) {
      return capitalize(relativeTimeFormatter.format(Math.round(diffMs / ms), unit));
    }
  }

  return capitalize(relativeTimeFormatter.format(Math.round(diffMs / (1000 * 60)), "minute"));
}

/** Compact relative time ("6h", "2h", "3d") for note/reply timestamps —
 * deliberately not `formatTimeAgo`'s "6 hours ago" output, which reads fine
 * as a full sentence but is too wide for a single metadata row sitting next
 * to an author name. Handcrafted rather than pulled from a date library
 * because `Intl.RelativeTimeFormat`'s shortest built-in style is "narrow"
 * ("6 hr. ago"), not this bare-unit form, and no standard library ships it
 * either. */
export function formatShortTimeAgo(savedAt: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - savedAt) / 1000));
  if (seconds < 60) return "now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;

  const years = Math.floor(days / 365);
  return `${years}y`;
}

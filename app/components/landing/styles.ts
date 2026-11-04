// The landing's shared class strings, in a plain module so the server page
// and client components can both import them.

/** The landing's section title (serif, 24px on a phone up to 44px). */
export const SECTION_TITLE = "m-0 font-serif text-[24px]/[1.15] font-semibold text-balance md:text-[clamp(28px,3vw,44px)]/[1.1]";
/** A section's line under its title (serif, 15px on a phone, 17px up). */
export const SECTION_LINE = "m-0 font-serif text-[15px]/[1.6] md:text-[17px]/[1.7]";
/** Horizontal page padding: 20px on mobile up to 56px. */
export const GUTTER = "px-5 md:px-[clamp(20px,4vw,56px)]";

// Buttons (the design system's Button): primary for the main action,
// secondary beside it on light, inverse beside it on dark.
const BASE = "inline-flex items-center justify-center rounded-sm font-sans font-semibold whitespace-nowrap no-underline transition-colors";
export const BUTTON = `${BASE} h-11.5 px-5 text-[15px]`;
export const BUTTON_SM = `${BASE} h-9.5 px-4 text-[14px]`;
export const PRIMARY = "bg-brand-500 text-sand-25 hover:bg-brand-600 hover:text-sand-25";
export const SECONDARY = "border border-[var(--color-app-border)] bg-transparent text-[var(--reader-text)] hover:bg-[var(--color-app-surface-muted)]";
export const INVERSE = "bg-sand-25 text-sand-950 hover:bg-sand-100 hover:text-sand-950";

// The two button looks the group surfaces share: the brand Join and the
// bordered secondary (Invite, Cancel), and that square for an icon.
const shape =
  "inline-flex h-9 flex-none cursor-pointer items-center justify-center gap-1.5 rounded-sm text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const base = `${shape} px-4`;
const bordered = "border border-[var(--reader-border)] bg-transparent text-[var(--reader-text)] no-underline hover:bg-[var(--reader-surface-hover)]";

export const primaryButton = `${base} border border-brand-500 bg-brand-500 text-white hover:bg-brand-600`;

export const secondaryButton = `${base} ${bordered}`;

/** The secondary look, square, for an icon alone (the header's ⋯). */
export const secondaryIconButton = `${shape} w-9 ${bordered}`;

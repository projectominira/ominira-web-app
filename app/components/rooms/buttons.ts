// The design system's Button (Rooms v4 `_ds` forms/Button.jsx) as classes:
// md is 12/20 padding on text-ui-md, sm 9/16 on text-ui-sm.

const VARIANTS = {
  primary: "border-transparent bg-brand-500 text-sand-25 hover:bg-brand-600 active:bg-brand-700",
  secondary: "border-sand-300 bg-transparent text-[var(--color-app-text)] hover:bg-sand-75 active:bg-sand-100",
  outlineBrand: "border-brand-500 bg-transparent text-[var(--color-app-brand)] hover:bg-brand-50 active:bg-brand-100",
  ghost: "border-transparent bg-transparent text-[var(--color-app-text)] hover:bg-sand-75 active:bg-sand-100",
  inverse: "border-transparent bg-[var(--reader-bg)] text-sand-900 hover:bg-sand-100 active:bg-sand-200",
} as const;

const SIZES = { md: "rounded-md px-5 py-3 text-ui-md", sm: "rounded-sm px-4 py-2.25 text-ui-sm" } as const;

export function button(variant: keyof typeof VARIANTS, { size = "md", full = false }: { size?: keyof typeof SIZES; full?: boolean } = {}) {
  return `inline-flex cursor-pointer items-center justify-center gap-2 border transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:bg-sand-200 disabled:text-[var(--color-app-text-muted)] ${SIZES[size]} ${VARIANTS[variant]} ${full ? "w-full" : ""}`;
}

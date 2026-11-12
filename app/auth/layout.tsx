import type { Metadata } from "next";
import type { ReactNode } from "react";

// Sign-in and onboarding screens aren't search results (seo-spec.md T3).
export const metadata: Metadata = { robots: { index: false, follow: true } };

/**
 * Onboarding screens live outside app/(app) — no sidebar/bottom nav, no
 * NowPlayingBar-reserved padding. Each page owns its own background (dark
 * hero vs. cream form) rather than this layout picking one.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}

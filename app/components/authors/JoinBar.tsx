"use client";

import Link from "next/link";
import { isSessionValid, useSessionStore } from "@/stores/session-store";

/** The invitation at the foot of a public page, for visitors only (never
 * flashed at a member before their session loads). */
export default function JoinBar({ children }: { children: React.ReactNode }) {
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const session = useSessionStore((s) => s.session);
  if (!hasHydrated || isSessionValid(session)) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-5 border-t border-[var(--color-app-border)] pt-7">
      <span className="max-w-[440px] font-serif text-[17px]/[1.5] text-[var(--color-app-text)]">{children}</span>
      <Link href="/auth/signup" className="flex h-[42px] items-center rounded-sm bg-brand-500 px-5 text-[15px] font-semibold text-white no-underline hover:bg-brand-600">
        Join Ominira
      </Link>
    </div>
  );
}

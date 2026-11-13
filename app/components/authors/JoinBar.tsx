"use client";

import Link from "next/link";
import { isSessionValid, useSessionStore } from "@/stores/session-store";

/** The invitation at the foot of a public page, for visitors only (never
 * flashed at a member before their session loads). A plain "Join us" link. */
export default function JoinBar({ editorial = false }: { /** The SEO pages' design: a rule above, no box. */ editorial?: boolean }) {
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const session = useSessionStore((s) => s.session);
  if (!hasHydrated || isSessionValid(session)) return null;
  return (
    <div
      className={
        editorial
          ? "mt-[18px] flex flex-wrap items-center justify-between gap-5 border-t border-[var(--color-app-border)] pt-7"
          : "mt-6 flex flex-wrap items-center justify-between gap-4 rounded-sm border border-[var(--color-app-border)] p-5"
      }
    >
      <p className="m-0 flex max-w-[480px] flex-col gap-0.5 text-ui-body-regular text-[var(--color-app-text-secondary)]">
        <b className="text-[14px] font-semibold leading-tight text-[var(--color-app-text)]">The largest collection of books online for Pan-Africanists.</b>
        Read, or listen with African voices.
      </p>
      <Link
        href="/auth/signup"
        className="text-[14px] font-semibold text-[var(--color-app-brand)] no-underline hover:text-brand-600 hover:underline"
      >
        Join us
      </Link>
    </div>
  );
}

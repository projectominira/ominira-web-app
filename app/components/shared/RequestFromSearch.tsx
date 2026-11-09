"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useIsAuthenticated } from "@/lib/auth/useIsAuthenticated";
import { useBookRequest } from "@/lib/materials/useBookRequest";
import RequestBookModal from "./RequestBookModal";

/** Under a library search with no results: one tap turns the search into a
 * request, so a reader never just hits a dead end. Key it by the query. */
export default function RequestFromSearch({ query }: { query: string }) {
  const isAuthenticated = useIsAuthenticated();
  const { send, state, error } = useBookRequest();
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className="mx-auto mt-2 max-w-[360px] text-center">
      {state === "sent" ? (
        <p role="status" className="m-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--reader-text)]">
          <Check size={15} className="flex-none text-emerald-600" />
          On it. We&rsquo;ll let you know the moment it&rsquo;s in.
        </p>
      ) : (
        <>
          <p className="m-0 mb-4 text-[13px] text-[var(--reader-text-muted)]">
            It&rsquo;s not in the library yet. Make a request and we&rsquo;ll add it (usually within 24 hours).
          </p>
          {isAuthenticated ? (
            <div className="flex flex-col items-center gap-2.5">
              <button
                type="button"
                onClick={() => void send(query.trim())}
                disabled={state === "sending"}
                className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full border-none bg-brand-500 px-5 text-[13px] font-bold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state === "sending" && <Loader2 size={14} className="animate-spin" />}
                Request
              </button>
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className="cursor-pointer border-none bg-transparent p-0 text-[12px] font-semibold text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]"
              >
                Add more detail
              </button>
              {error && (
                <p role="alert" className="m-0 text-[12px] font-semibold text-red-500">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="inline-flex h-10 items-center justify-center rounded-full bg-brand-500 px-5 text-[13px] font-bold text-white no-underline hover:bg-brand-600"
            >
              Sign in to ask for it
            </Link>
          )}
        </>
      )}
      {detailsOpen && <RequestBookModal initialText={query.trim()} onClose={() => setDetailsOpen(false)} />}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminSearch } from "@/app/admin/AdminControls";
import type { AdminQuote } from "@/lib/quotes/directory";

type Props = { q: string; page: number; quotes: AdminQuote[]; more: boolean; total: number };

const href = (q: string, page = 1) => {
  const p = new URLSearchParams({ ...(q && { q }), ...(page > 1 && { page: String(page) }) }).toString();
  return p ? `/admin/ai/quotes?${p}` : "/admin/ai/quotes";
};

const button =
  "inline-flex h-8 flex-none cursor-pointer items-center justify-center rounded-sm border border-[var(--reader-border)] bg-transparent px-3 text-[12px] font-bold text-[var(--reader-text)] transition-colors hover:bg-[var(--reader-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50";

/** Every quote in the directory, newest first, hidden ones in place; Hide
 * takes one off /quotes and the author and topic pages, Show puts it back. */
export default function QuotesAdminView(props: Props) {
  // Remounted on every navigation, so the rows below start from the server's.
  return <View key={href(props.q, props.page)} {...props} />;
}

function View({ q, page, quotes: initial, more, total }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [quotes, setQuotes] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (id: string, hidden: boolean) => {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/quotes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Please try again.");
      setQuotes((all) => all.map((x) => (x.id === id ? { ...x, hidden } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const hiddenHere = quotes.filter((x) => x.hidden).length;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[13px] font-medium text-[var(--reader-text-muted)]">
          {total.toLocaleString()} quotes{q ? ` matching “${q}”` : ""}
          {hiddenHere > 0 && ` · ${hiddenHere} hidden on this page`}
        </p>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(href(search.trim()));
          }}
        >
          <AdminSearch value={search} onChange={setSearch} placeholder="Search the words" label="Search quotes" />
        </form>
      </div>

      {error && <p className="m-0 mb-4 text-[13px] font-semibold text-red-600">{error}</p>}

      {quotes.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-[var(--reader-text-muted)]">
          {q ? "No quotes match." : "No quotes in the directory yet."}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-[var(--reader-border)] border-y border-[var(--reader-border)] p-0">
          {quotes.map((x) => (
            <li key={x.id} className="flex items-start gap-4 py-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className={`m-0 font-serif text-[15px]/[1.55] text-pretty ${x.hidden ? "text-[var(--reader-text-muted)] line-through decoration-[var(--reader-text-subtle)]" : "text-[var(--reader-text)]"}`}>“{x.text}”</p>
                <p className="m-0 text-[12px] font-medium text-[var(--reader-text-muted)]">
                  <b className="font-semibold">{x.book.author}</b> ·{" "}
                  <Link href={`/library/${x.book.slug}`} target="_blank" className="text-inherit hover:underline">
                    {x.book.title}
                  </Link>
                  {x.topics.length > 0 && <> · {x.topics.join(", ")}</>}
                  {x.hidden && <> · Hidden</>}
                </p>
              </div>
              <button type="button" className={button} disabled={busy === x.id} onClick={() => toggle(x.id, !x.hidden)}>
                {x.hidden ? "Show" : "Hide"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {(more || page > 1) && (
        <nav className="mt-5 flex justify-center gap-2">
          {page > 1 && (
            <Link href={href(q, page - 1)} className={`${button} no-underline`}>
              Previous
            </Link>
          )}
          {more && (
            <Link href={href(q, page + 1)} className={`${button} no-underline`}>
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AdminPageHeader from "@/app/admin/AdminPageHeader";
import { AdminSearch, AdminSelect } from "@/app/admin/AdminControls";
import type { AdminQuote } from "@/lib/quotes/directory";

type Props = { q: string; hidden: boolean; page: number; quotes: AdminQuote[]; more: boolean; total: number };

const href = (q: string, hidden: boolean, page = 1) => {
  const p = new URLSearchParams({ ...(q && { q }), ...(hidden && { show: "hidden" }), ...(page > 1 && { page: String(page) }) }).toString();
  return p ? `/admin/quotes?${p}` : "/admin/quotes";
};

const button =
  "inline-flex h-8 flex-none cursor-pointer items-center justify-center rounded-sm border border-[var(--reader-border)] bg-transparent px-3 text-[12px] font-bold text-[var(--reader-text)] transition-colors hover:bg-[var(--reader-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50";

/** Every quote in the directory, newest first; Hide takes one off /quotes
 * and the author and topic pages, Show puts it back. */
export default function QuotesAdminView(props: Props) {
  // Remounted on every navigation, so the lists below start from the server's rows.
  return <View key={href(props.q, props.hidden, props.page)} {...props} />;
}

function View({ q, hidden, page, quotes, more, total }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [moved, setMoved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/quotes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: !hidden }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Please try again.");
      setMoved((s) => new Set(s).add(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const shown = quotes.filter((x) => !moved.has(x.id));
  const count = total - moved.size;

  return (
    <>
      <AdminPageHeader
        title="Quotes"
        subtitle={`${count.toLocaleString()} ${hidden ? "hidden" : "in the directory"}${q ? ` matching “${q}”` : ""}`}
        actions={
          <>
            <form
              className="contents"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(href(search.trim(), hidden));
              }}
            >
              <AdminSearch value={search} onChange={setSearch} placeholder="Search the words" label="Search quotes" />
            </form>
            <AdminSelect
              value={hidden ? "hidden" : "listed"}
              onChange={(v) => router.push(href(q, v === "hidden"))}
              options={[
                { value: "listed", label: "Listed" },
                { value: "hidden", label: "Hidden" },
              ]}
              label="Show"
            />
          </>
        }
      />

      {error && <p className="m-0 mb-4 text-[13px] font-semibold text-red-600">{error}</p>}

      {shown.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-[var(--reader-text-muted)]">
          {q ? "No quotes match." : hidden ? "No hidden quotes." : "No quotes in the directory yet."}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-[var(--reader-border)] border-y border-[var(--reader-border)] p-0">
          {shown.map((x) => (
            <li key={x.id} className="flex items-start gap-4 py-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="m-0 font-serif text-[15px]/[1.55] text-pretty text-[var(--reader-text)]">“{x.text}”</p>
                <p className="m-0 text-[12px] font-medium text-[var(--reader-text-muted)]">
                  <b className="font-semibold">{x.book.author}</b> ·{" "}
                  <Link href={`/library/${x.book.slug}`} target="_blank" className="text-inherit hover:underline">
                    {x.book.title}
                  </Link>
                  {x.topics.length > 0 && <> · {x.topics.join(", ")}</>}
                </p>
              </div>
              <button type="button" className={button} disabled={busy === x.id} onClick={() => toggle(x.id)}>
                {hidden ? "Show" : "Hide"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {(more || page > 1) && (
        <nav className="mt-5 flex justify-center gap-2">
          {page > 1 && (
            <Link href={href(q, hidden, page - 1)} className={`${button} no-underline`}>
              Previous
            </Link>
          )}
          {more && (
            <Link href={href(q, hidden, page + 1)} className={`${button} no-underline`}>
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

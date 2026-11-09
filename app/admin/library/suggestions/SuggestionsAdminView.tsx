"use client";

import { Check, ExternalLink, FolderDown, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import AdminPageHeader from "@/app/admin/AdminPageHeader";
import { AdminSearch, AdminSelect } from "@/app/admin/AdminControls";
import { formatTimeAgo } from "@/lib/reader/timeAgo";
import { driveFolderId } from "@/lib/materials/googleDrive";
import { useMaterialsSearch } from "@/lib/materials/useMaterialsSearch";
import type { SuggestionStatus } from "@/lib/materials/suggestions";

export type AdminSuggestion = {
  id: string;
  text: string;
  url: string | null;
  by: string | null;
  status: SuggestionStatus;
  createdAt: string;
};

type Filter = SuggestionStatus | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Added" },
  { value: "declined", label: "Declined" },
  { value: "all", label: "All" },
];

const STATUS_LABEL: Record<SuggestionStatus, string> = { pending: "Pending", approved: "Added", declined: "Declined" };

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const action =
  "inline-flex h-7 cursor-pointer items-center gap-1 rounded-sm border border-[var(--reader-border)] bg-transparent px-2 text-[11px] font-semibold text-[var(--reader-text)] no-underline transition-colors hover:bg-[var(--reader-surface-hover)]";

const COLUMNS = 6;

/** /admin/library/suggestions: what readers asked for and couldn't find
 * (RequestBookModal, or a search with no results). Marking one added
 * notifies the reader — pick the book first and the notification links to it. */
export default function SuggestionsAdminView({ suggestions }: { suggestions: AdminSuggestion[] }) {
  const [items, setItems] = useState(suggestions);
  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingCount = items.filter((s) => s.status === "pending").length;
  const q = query.trim().toLowerCase();
  const visible = items.filter(
    (s) => (filter === "all" || s.status === filter) && (!q || s.text.toLowerCase().includes(q) || s.by?.toLowerCase().includes(q))
  );

  const setStatus = async (item: AdminSuggestion, status: SuggestionStatus, materialId?: string) => {
    setError(null);
    setPicking(null);
    setItems((list) => list.map((s) => (s.id === item.id ? { ...s, status } : s)));
    try {
      const response = await fetch(`/api/admin/suggestions/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, materialId }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setItems((list) => list.map((s) => (s.id === item.id ? { ...s, status: item.status } : s)));
      setError("Couldn't update that request. Please try again.");
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Book requests"
        subtitle={`${pendingCount.toLocaleString("en")} pending`}
        back={{ href: "/admin/library", label: "Library" }}
        actions={
          <>
            <AdminSearch value={query} onChange={setQuery} placeholder="Search requests or readers" label="Search requests" />
            <AdminSelect value={filter} onChange={setFilter} options={FILTERS} label="Filter by status" />
          </>
        }
      />

      {error && (
        <p role="status" className="m-0 mb-3 text-[12px] font-semibold text-red-500">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-sm border border-[var(--reader-border)]">
        {visible.length === 0 ? (
          <p className="m-0 px-5 py-10 text-center text-sm text-[var(--reader-text-muted)]">
            {items.length === 0 ? "No requests yet." : q ? "Nothing matches that search." : "Nothing here."}
          </p>
        ) : (
          <table className="w-full min-w-[860px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--reader-border)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--reader-text-subtle)]">
                <th className="px-3 py-2.5 font-[inherit]">Request</th>
                <th className="px-3 py-2.5 font-[inherit]">Link</th>
                <th className="px-3 py-2.5 font-[inherit]">Reader</th>
                <th className="px-3 py-2.5 font-[inherit]">Status</th>
                <th className="px-3 py-2.5 font-[inherit]">Asked</th>
                <th className="px-3 py-2.5 font-[inherit]">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const folder = s.url && driveFolderId(s.url);
                return [
                  <tr key={s.id} className="border-b border-[var(--reader-border)] last:border-b-0">
                    <td className="max-w-[380px] px-3 py-2.5 align-middle">
                      <p className="m-0 line-clamp-2 whitespace-pre-line font-semibold text-[var(--reader-text)]" title={s.text}>
                        {s.text}
                      </p>
                    </td>
                    <td className="max-w-[160px] px-3 py-2.5 align-middle">
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1 text-brand-500 no-underline hover:underline">
                          <ExternalLink size={11} className="flex-none" />
                          <span className="truncate">{hostOf(s.url)}</span>
                        </a>
                      ) : (
                        <span className="text-[var(--reader-text-muted)]">—</span>
                      )}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-2.5 align-middle text-[var(--reader-text-muted)]">{s.by ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                      <span
                        className={`rounded-full bg-[var(--reader-surface-hover)] px-2 py-0.5 text-[11px] font-semibold ${
                          s.status === "pending" ? "text-[var(--reader-text)]" : "text-[var(--reader-text-muted)]"
                        }`}
                      >
                        {STATUS_LABEL[s.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-middle text-[var(--reader-text-muted)]">{formatTimeAgo(new Date(s.createdAt).getTime())}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        {s.status === "pending" ? (
                          <>
                            {folder && (
                              <Link href={`/admin/library/new?drive=${encodeURIComponent(s.url!)}`} className={action}>
                                <FolderDown size={12} />
                                Import
                              </Link>
                            )}
                            <button
                              type="button"
                              onClick={() => setPicking(picking === s.id ? null : s.id)}
                              aria-expanded={picking === s.id}
                              className={action}
                            >
                              <Check size={12} />
                              Added
                            </button>
                            <button type="button" onClick={() => void setStatus(s, "declined")} className={`${action} text-[var(--reader-text-muted)]`}>
                              <X size={12} />
                              Decline
                            </button>
                          </>
                        ) : (
                          <button type="button" onClick={() => void setStatus(s, "pending")} className={`${action} text-[var(--reader-text-muted)]`}>
                            <RotateCcw size={12} />
                            Undo
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>,
                  picking === s.id && (
                    <tr key={`${s.id}-pick`} className="border-b border-[var(--reader-border)] bg-[var(--reader-bg)]">
                      <td colSpan={COLUMNS} className="px-4 py-4">
                        <BookPicker
                          seed={s.text}
                          onPick={(materialId) => void setStatus(s, "approved", materialId)}
                          onSkip={() => void setStatus(s, "approved")}
                        />
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** Which book answers the request — so the reader's notification opens it. */
function BookPicker({ seed, onPick, onSkip }: { seed: string; onPick: (materialId: string) => void; onSkip: () => void }) {
  const [search, setSearch] = useState(() => seed.replace(/\bhttps?:\/\/\S+/g, "").trim().slice(0, 80));
  const { results, isSearching } = useMaterialsSearch(search, { limit: 5 });

  return (
    <div className="flex max-w-[560px] flex-col gap-2">
      <p className="m-0 text-[12px] font-semibold text-[var(--reader-text)]">Which book is it? We&rsquo;ll send the reader straight to it.</p>
      <AdminSearch value={search} onChange={setSearch} placeholder="Search the library" label="Find the book" />
      <ul className="m-0 flex list-none flex-col p-0">
        {isSearching ? (
          <li className="py-2 text-[12px] text-[var(--reader-text-muted)]">Searching…</li>
        ) : (
          results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onPick(m.id)}
                className="flex w-full cursor-pointer items-baseline gap-2 rounded-sm border-none bg-transparent px-2 py-1.5 text-left text-[12px] hover:bg-[var(--reader-surface-hover)]"
              >
                <span className="truncate font-semibold text-[var(--reader-text)]">{m.title}</span>
                <span className="flex-none text-[var(--reader-text-muted)]">{m.author}</span>
              </button>
            </li>
          ))
        )}
        {!isSearching && search.trim() && results.length === 0 && <li className="py-2 text-[12px] text-[var(--reader-text-muted)]">No match in the library.</li>}
      </ul>
      <button type="button" onClick={onSkip} className="cursor-pointer self-start border-none bg-transparent p-0 text-[12px] font-semibold text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]">
        Mark added without a book
      </button>
    </div>
  );
}

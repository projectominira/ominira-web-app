"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { AdminPanelHeader, AdminSearch, AdminSidePanel } from "@/app/admin/AdminControls";

// The AI tabs (Authors, Topics, Reading lists): everything the AI wrote is
// on the site; a list of rows, one side panel to edit a row or take it off
// the site and put it back.

export const primary =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-sm border-none bg-brand-500 px-4 text-[12px] font-bold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
export const secondary =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-sm border border-[var(--reader-border)] bg-transparent px-4 text-[12px] font-bold text-[var(--reader-text)] transition-colors hover:bg-[var(--reader-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50";

export const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** PATCHes an AI page; resolves to an error message, or null when it saved. */
export async function patch(url: string, body: unknown): Promise<string | null> {
  try {
    const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (response.ok) return null;
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    return result?.error || "Please try again.";
  } catch {
    return "Please try again.";
  }
}

type Item = { id: string; title: string; detail: string; off: boolean; note?: string; leading?: ReactNode; search: string };

/** Count, search and the rows; the selected row's editor opens in the side panel. */
export function AiList<T extends { id: string }>({
  items,
  row,
  noun,
  empty,
  panel,
}: {
  items: T[];
  row: (item: T) => Item;
  noun: [string, string];
  empty: string;
  panel: (item: T, close: () => void) => { title: string; subtitle?: string; body: ReactNode };
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const rows = items.map((item) => ({ item, ...row(item) }));
  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((r) => r.search.toLowerCase().includes(q)) : rows;
  const off = rows.filter((r) => r.off).length;
  const open = rows.find((r) => r.id === selected);
  const close = () => setSelected(null);
  const content = open && panel(open.item, close);

  if (items.length === 0) return <p className="py-10 text-center text-[14px] text-[var(--reader-text-muted)]">{empty}</p>;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[13px] font-medium text-[var(--reader-text-muted)]">
          {items.length} {items.length === 1 ? noun[0] : noun[1]}
          {off > 0 && ` · ${off} off the site`}
        </p>
        <AdminSearch value={query} onChange={setQuery} placeholder="Search" label={`Search ${noun[1]}`} />
      </div>
      {shown.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-[var(--reader-text-muted)]">Nothing matches.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-[var(--reader-border)] border-y border-[var(--reader-border)] p-0">
          {shown.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r.id)}
                aria-current={selected === r.id ? "true" : undefined}
                className={`flex w-full cursor-pointer items-center gap-3 border-none px-2 py-3 text-left transition-colors hover:bg-[var(--reader-surface-hover)] ${
                  selected === r.id ? "bg-[var(--reader-surface-hover)]" : "bg-transparent"
                }`}
              >
                {r.leading}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={`truncate text-[14px] font-semibold ${r.off ? "text-[var(--reader-text-muted)]" : "text-[var(--reader-text)]"}`}>{r.title}</span>
                  <span className="truncate text-[12px] font-medium text-[var(--reader-text-muted)]">{r.detail}</span>
                </span>
                {(r.off || r.note) && (
                  <span className="flex-none rounded-sm border border-[var(--reader-border)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--reader-text-muted)]">
                    {r.off ? "Off the site" : r.note}
                  </span>
                )}
                <ChevronRight size={15} className="flex-none text-[var(--reader-text-subtle)]" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && content && (
        <AdminSidePanel label={content.title} onClose={close}>
          <AdminPanelHeader title={content.title} subtitle={content.subtitle} onClose={close} />
          <div key={open.id} className="flex flex-col gap-4 px-5 py-5">
            {content.body}
          </div>
        </AdminSidePanel>
      )}
    </>
  );
}

/** A panel's link to the public page. */
export function PageLink({ href }: { href: string }) {
  return (
    <Link href={href} target="_blank" className="inline-flex items-center gap-1 self-start text-[12px] font-semibold text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]">
      {href} <ExternalLink size={12} />
    </Link>
  );
}

/** Save, and the one reversible switch: take it off the site, or put it back. */
export function PanelFooter({ busy, off, canSave = true, message, onSave, onToggle }: { busy: boolean; off: boolean; canSave?: boolean; message: string | null; onSave: () => void; onToggle: () => void }) {
  return (
    <footer className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center gap-2 border-t border-[var(--reader-border)] bg-[var(--reader-surface)] px-5 py-3">
      <button type="button" className={primary} disabled={busy || !canSave} onClick={onSave}>
        Save
      </button>
      <button type="button" className={secondary} disabled={busy} onClick={onToggle}>
        {off ? "Put back on the site" : "Take off the site"}
      </button>
      {message && <span className="text-[12px] font-semibold text-[var(--reader-text-muted)]">{message}</span>}
    </footer>
  );
}

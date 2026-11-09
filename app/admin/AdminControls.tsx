"use client";

import type { ReactNode } from "react";
import RowMenu from "@/app/components/groups/RowMenu";
import type { OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";

/** Search and filter controls for an admin page's header (AdminPageHeader's
 * `actions`), sized to sit on one line with its buttons. */
export function AdminSearch({ value, onChange, placeholder, label }: { value: string; onChange: (value: string) => void; placeholder: string; label: string }) {
  return (
    <label className="relative w-full min-w-0 sm:w-64">
      <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--reader-text-subtle)]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-9 w-full rounded-sm border border-sand-300 bg-[var(--reader-surface)] pr-3 pl-8 text-[13px] font-medium text-[var(--reader-text)] outline-none transition-colors placeholder:text-sand-400 focus:border-brand-400"
      />
    </label>
  );
}

export function AdminSelect<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <label className="relative flex-none">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label={label}
        className="h-9 cursor-pointer appearance-none rounded-sm border border-sand-300 bg-[var(--reader-surface)] pr-9 pl-3 text-[13px] font-medium text-[var(--reader-text)] outline-none transition-colors focus:border-brand-400"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute inset-y-0 right-3 my-auto text-sand-500" />
    </label>
  );
}

/** A page's actions in one ⋯ menu at the end of its header, sized with the
 * search box beside it. */
export function AdminMenu({ items }: { items: OverflowMenuItem[] }) {
  return (
    <RowMenu
      label="More actions"
      items={items}
      buttonClassName="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border border-sand-300 bg-transparent text-[var(--reader-text-muted)] transition-colors hover:bg-[var(--reader-surface-hover)] hover:text-[var(--reader-text)]"
    />
  );
}

/** A table row that opens a panel beneath it. */
export function ExpandRow({
  open,
  onToggle,
  cells,
  columns,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  cells: ReactNode;
  columns: number;
  children: ReactNode;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <>
      <tr
        onClick={onToggle}
        aria-expanded={open}
        className={`cursor-pointer border-b border-[var(--reader-border)] hover:bg-[var(--reader-surface-hover)] ${open ? "bg-[var(--reader-surface-hover)]" : ""}`}
      >
        <td className="w-8 py-2.5 pr-0 pl-3 align-middle">
          <Chevron size={15} className="text-[var(--reader-text-subtle)]" />
        </td>
        {cells}
      </tr>
      {open && (
        <tr className="border-b border-[var(--reader-border)] bg-[var(--reader-bg)]">
          <td colSpan={columns} className="px-4 py-5 sm:pr-5 sm:pl-11">
            {children}
          </td>
        </tr>
      )}
    </>
  );
}


/** The panel a row opens on the right (Library, Passages). From xl the page
 * column moves aside for it (AdminShell); below that it overlays, with a
 * backdrop to dismiss. */
export function AdminSidePanel({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 xl:hidden" onClick={onClose} aria-hidden />
      <aside
        data-side-panel
        aria-label={label}
        className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-[var(--reader-border)] bg-[var(--reader-surface)] shadow-xl sm:w-[440px] xl:shadow-none"
      >
        {children}
      </aside>
    </>
  );
}

/** A side panel's sticky top line: title, optional subtitle, close. */
export function AdminPanelHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--reader-border)] bg-[var(--reader-surface)] px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-[13px] font-bold text-[var(--reader-text)]">{title}</p>
        {subtitle && <p className="m-0 truncate text-ui-caption text-[var(--reader-text-muted)]">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="inline-flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-[var(--reader-text-muted)] transition-colors hover:bg-[var(--reader-surface-hover)] hover:text-[var(--reader-text)]"
      >
        <X size={16} />
      </button>
    </div>
  );
}

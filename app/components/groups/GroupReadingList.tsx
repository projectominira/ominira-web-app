"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import BookCover from "@/app/components/shared/BookCover";
import { resolveBookThumbnailSrc } from "@/lib/materials/image";
import { Search, Upload } from "lucide-react";
import Loader from "@/app/components/Loader";
import { DateRangeSheet } from "@/app/components/shared/DatePicker";
import type { OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";
import { useProfile } from "@/lib/auth/useProfile";
import { bookDates, sessionCount } from "@/lib/groups/copy";
import {
  useAddGroupBook,
  useGroup,
  useGroupBooks,
  useGroupSessions,
  useRemoveGroupBook,
  useReorderGroupBooks,
  useUpdateGroupBook,
} from "@/lib/groups/hooks";
import { sessionDays } from "@/lib/groups/sessions";
import type { GroupBook } from "@/lib/groups/types";
import { confirmAction } from "@/stores/confirm-store";
import { showToast } from "@/stores/toast-store";
import { onFail } from "./onFail";
import RowMenu from "./RowMenu";
import CoverStatus from "./CoverStatus";
import ListHeader from "./ListHeader";

// Opened on demand only: the upload pipeline and the library search.
const AddBookModal = dynamic(() => import("@/app/components/shell/AddBookModal"));
const LibraryPickerSheet = dynamic(() => import("./LibraryPickerSheet"));

type Sheet = { kind: "library" } | { kind: "upload" } | { kind: "dates"; book: GroupBook } | null;

/**
 * Manage → Reading list (spec §3.2 M9): one list in reading order — the
 * book read now, Up next in the moderators' order, then the finished ones —
 * each book's status on its cover, its dates under the title, and its ⋯
 * (Read this now, Move up/down, Edit dates, Mark as finished, Remove).
 * From library and Upload add to it.
 */
export default function GroupReadingList({ slug, categories }: { slug: string; categories: string[] }) {
  const { data: page, isLoading } = useGroup(slug);
  const { data: books, isLoading: booksLoading } = useGroupBooks(slug);
  const { data: sessions } = useGroupSessions(slug);
  const { data: profile } = useProfile();
  const add = useAddGroupBook(slug);
  const update = useUpdateGroupBook(slug);
  const remove = useRemoveGroupBook(slug);
  const reorder = useReorderGroupBooks(slug);
  const [sheet, setSheet] = useState<Sheet>(null);

  if (isLoading || booksLoading) {
    return (
      <div className="relative min-h-40">
        <Loader confined />
      </div>
    );
  }
  if (!page) return null;

  const all = books ?? [];
  const next = all.filter((b) => b.status === "next");
  const list = [...all.filter((b) => b.status === "current"), ...next, ...all.filter((b) => b.status === "done")];

  const setStatus = (book: GroupBook, status: "current" | "done") =>
    update.mutate({ materialId: book.material.id, update: { status } }, { onError: onFail("Couldn't update the list.") });
  const onRemove = async (book: GroupBook) => {
    const ok = await confirmAction({ title: `Remove "${book.material.title}" from the list?`, confirmLabel: "Remove", danger: true });
    if (ok) remove.mutate(book.material.id, { onError: onFail("Couldn't remove it.") });
  };
  // The first book on an empty list becomes current (lib/groups/books.ts).
  const addBook = (materialId: string) => {
    const first = all.length === 0;
    return add.mutateAsync(materialId).then(
      () => showToast(first ? "Added as Reading now" : "Added to Up next"),
      (err) => {
        onFail("Couldn't add that book.")(err);
        throw err;
      }
    );
  };
  // Swap a book in Up next with its neighbour; the whole order is saved.
  const move = (book: GroupBook, by: -1 | 1) => {
    const order = next.map((b) => b.material.id);
    const i = order.indexOf(book.material.id);
    [order[i], order[i + by]] = [order[i + by], order[i]];
    reorder.mutate(order, { onError: onFail("Couldn't move it.") });
  };

  const items = (book: GroupBook): OverflowMenuItem[] => {
    const i = next.indexOf(book);
    return [
      ...(book.status === "current" ? [] : [{ label: "Read this now", onClick: () => setStatus(book, "current") }]),
      ...(i > 0 ? [{ label: "Move up", onClick: () => move(book, -1) }] : []),
      ...(i >= 0 && i < next.length - 1 ? [{ label: "Move down", onClick: () => move(book, 1) }] : []),
      { label: "Edit dates", onClick: () => setSheet({ kind: "dates", book }) },
      ...(book.status === "done" ? [] : [{ label: "Mark as finished", onClick: () => setStatus(book, "done") }]),
      { label: "Remove", onClick: () => void onRemove(book), danger: true },
    ];
  };

  const detail = (book: GroupBook) =>
    [bookDates(book), book.status === "done" && book.sessions > 0 ? sessionCount(book.sessions) : null].filter(Boolean).join(" · ") || null;

  return (
    <div className="flex flex-col gap-1 pt-1">
      <ListHeader
        count={all.length ? `${all.length} ${all.length === 1 ? "book" : "books"}` : "No books yet"}
        label="Add book"
        items={[
          { label: "From library", icon: <Search size={14} />, onClick: () => setSheet({ kind: "library" }) },
          ...(profile?.canUpload ? [{ label: "Upload", icon: <Upload size={14} />, onClick: () => setSheet({ kind: "upload" }) }] : []),
        ]}
      />

      {list.length > 0 && (
        <ul className="m-0 list-none p-0">
          {list.map((book) => {
            const { material } = book;
            const dates = detail(book);
            return (
              <li key={material.id} className="flex items-center gap-3.5 border-b border-[var(--reader-border)] py-3">
                <Link href={`/library/${material.slug}`} className="relative h-[68px] w-12 flex-none overflow-hidden rounded-xs">
                  <BookCover materialType={material.materialType} src={resolveBookThumbnailSrc(material)} alt={material.title} className="h-full w-full" iconSize={16} />
                  <CoverStatus status={book.status} />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Link href={`/library/${material.slug}`} className="truncate font-serif text-[14px] font-semibold text-[var(--reader-text)] no-underline hover:text-brand-500">
                    {material.title}
                  </Link>
                  {material.author && <span className="truncate text-xs text-[var(--reader-text-muted)]">{material.author}</span>}
                  {dates ? (
                    <span className="text-xs font-semibold text-[var(--reader-text-muted)]">{dates}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSheet({ kind: "dates", book })}
                      className="cursor-pointer self-start border-none bg-transparent p-0 text-xs font-semibold text-brand-500"
                    >
                      Set dates
                    </button>
                  )}
                </div>
                <RowMenu label={`Manage ${material.title}`} items={items(book)} />
              </li>
            );
          })}
        </ul>
      )}

      {sheet?.kind === "library" && (
        <LibraryPickerSheet listed={new Set(all.map((b) => b.material.id))} onClose={() => setSheet(null)} onPick={addBook} />
      )}
      {sheet?.kind === "upload" && (
        <AddBookModal publicOnly categories={categories} onClose={() => setSheet(null)} onUploaded={(book) => void addBook(book.materialId).catch(() => {})} />
      )}
      {sheet?.kind === "dates" && (
        <DateRangeSheet
          initial={{ start: sheet.book.startsOn, end: sheet.book.endsOn }}
          marks={sessions && sessionDays(sessions.upcoming, sessions.timezone)}
          onClose={() => setSheet(null)}
          onDone={({ start, end }) => {
            update.mutate(
              { materialId: sheet.book.material.id, update: { startsOn: start, endsOn: end } },
              { onError: onFail("Couldn't save the dates.") }
            );
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}

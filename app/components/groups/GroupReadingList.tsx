"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import BookCover from "@/app/components/shared/BookCover";
import { resolveBookThumbnailSrc } from "@/lib/materials/image";
import { ArrowDown, ArrowUp, BookOpen, Calendar, Check, Search, Trash2, Upload } from "lucide-react";
import Loader from "@/app/components/Loader";
import BookListRow, { type BookRowAction } from "@/app/components/shell/BookListRow";
import NoResults from "@/app/components/shared/NoResults";
import { DateRangeSheet } from "@/app/components/shared/DatePicker";
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
import { secondaryButton } from "./buttons";

// Opened on demand only: the upload pipeline and the library search.
const AddBookModal = dynamic(() => import("@/app/components/shell/AddBookModal"));
const LibraryPickerSheet = dynamic(() => import("./LibraryPickerSheet"));

type Sheet = { kind: "library" } | { kind: "upload" } | { kind: "dates"; book: GroupBook } | null;

const eyebrow = "text-[11px] font-bold uppercase tracking-[0.08em]";

/**
 * The reading list (spec §3.2 M9, D1), one grid like the library: Reading now, Up next in the
 * moderators' order, then Done, every book a `BookListRow` with the list's
 * dates under it. On the group page it's the same read-only list for
 * everyone, moderators included; `manage` (Manage → Reading list) adds each
 * book's ⋯ (Read this now, Move up/down, Edit dates, Mark as done, Remove),
 * From library and Upload.
 */
export default function GroupReadingList({
  slug,
  categories,
  manage = false,
}: {
  slug: string;
  categories: string[];
  manage?: boolean;
}) {
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

  const isModerator = page.myRole === "moderator";
  const list = books ?? [];
  const current = list.find((b) => b.status === "current");
  const next = list.filter((b) => b.status === "next");

  const setStatus = (book: GroupBook, status: "current" | "done") =>
    update.mutate({ materialId: book.material.id, update: { status } }, { onError: onFail("Couldn't update the list.") });
  const onRemove = async (book: GroupBook) => {
    const ok = await confirmAction({ title: `Remove "${book.material.title}" from the list?`, confirmLabel: "Remove", danger: true });
    if (ok) remove.mutate(book.material.id, { onError: onFail("Couldn't remove it.") });
  };
  // The first book on an empty list becomes current (lib/groups/books.ts).
  const addBook = (materialId: string) => {
    const first = list.length === 0;
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
  const moves = (book: GroupBook): BookRowAction[] => {
    if (book.status !== "next") return [];
    const i = next.indexOf(book);
    return [
      ...(i > 0 ? [{ label: "Move up", icon: ArrowUp, onSelect: () => move(book, -1) }] : []),
      ...(i < next.length - 1 ? [{ label: "Move down", icon: ArrowDown, onSelect: () => move(book, 1) }] : []),
    ];
  };

  const actions = (book: GroupBook): BookRowAction[] | undefined =>
    isModerator
      ? [
          ...(book.status === "current" ? [] : [{ label: "Read this now", icon: BookOpen, onSelect: () => setStatus(book, "current") }]),
          ...moves(book),
          { label: "Edit dates", icon: Calendar, onSelect: () => setSheet({ kind: "dates", book }) },
          ...(book.status === "done" ? [] : [{ label: "Mark as done", icon: Check, onSelect: () => setStatus(book, "done") }]),
          { label: "Remove", icon: Trash2, onSelect: () => void onRemove(book), danger: true },
        ]
      : undefined;

  const dates = (book: GroupBook) => {
    const label =
      [bookDates(book), book.status === "done" && book.sessions > 0 ? sessionCount(book.sessions) : null].filter(Boolean).join(" · ") ||
      null;
    if (!label) return null;
    return (
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--reader-text-muted)]">
        {book.status !== "done" && <Calendar size={14} />}
        {label}
      </span>
    );
  };

  const datesOrSet = (book: GroupBook) =>
    dates(book) ??
    (isModerator && (
      <button
        type="button"
        onClick={() => setSheet({ kind: "dates", book })}
        className="cursor-pointer self-start border-none bg-transparent p-0 text-xs font-semibold text-brand-500"
      >
        Set dates
      </button>
    ));
  const row = (book: GroupBook) => (
    <BookListRow
      key={book.material.id}
      material={book.material}
      detail={
        datesOrSet(book)
      }
      actions={actions(book)}
    />
  );
  const done = list.filter((b) => b.status === "done");
  const heading = (label: string) => <h2 className={`m-0 ${eyebrow} text-[var(--reader-text-subtle)]`}>{label}</h2>;

  const add_ = manage && isModerator && (
    <div className="flex flex-none gap-2">
      <button type="button" onClick={() => setSheet({ kind: "library" })} className={secondaryButton}>
        <Search size={15} />
        From library
      </button>
      {profile?.canUpload && (
        <button type="button" onClick={() => setSheet({ kind: "upload" })} className={secondaryButton}>
          <Upload size={15} />
          Upload
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-8 pt-1">
      {add_ && (
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-[13px] text-[var(--reader-text-muted)]">Books the group reads, in order.</p>
          {add_}
        </div>
      )}
      {list.length === 0 && <NoResults message="No books on the list yet." />}

      {current && (
        <section aria-label="Reading now" className="flex flex-col gap-4 rounded-md border border-[var(--reader-border)] bg-[var(--reader-surface)] p-5">
          <div className="flex gap-4">
            <Link href={`/library/${current.material.slug}`} className="h-[120px] w-20 flex-none overflow-hidden rounded-xs">
              <BookCover
                materialType={current.material.materialType}
                src={resolveBookThumbnailSrc(current.material)}
                alt={current.material.title}
                className="h-full w-full"
              />
            </Link>
            <div className="flex min-w-0 flex-col justify-center gap-1.5">
              <span className={`${eyebrow} text-brand-500`}>Reading now</span>
              <Link href={`/library/${current.material.slug}`} className="line-clamp-2 font-serif text-[17px] leading-snug font-semibold text-[var(--reader-text)] no-underline">
                {current.material.title}
              </Link>
              {current.material.author && <span className="truncate text-[13px] text-[var(--reader-text-muted)]">{current.material.author}</span>}
              {datesOrSet(current)}
            </div>
          </div>
          {isModerator && (
            <div className="flex gap-2.5 border-t border-[var(--reader-border)] pt-4">
              <button type="button" onClick={() => setSheet({ kind: "dates", book: current })} className={secondaryButton}>
                <Calendar size={15} />
                Edit dates
              </button>
              <button type="button" onClick={() => setStatus(current, "done")} className={secondaryButton}>
                <Check size={15} />
                Mark as done
              </button>
            </div>
          )}
        </section>
      )}

      {next.length > 0 && (
        <section className="flex flex-col gap-1">
          {heading("Up next")}
          <div>{next.map(row)}</div>
        </section>
      )}

      {done.length > 0 && (
        <section className="flex flex-col gap-1">
          {heading("Done")}
          <div>{done.map(row)}</div>
        </section>
      )}

      {sheet?.kind === "library" && (
        <LibraryPickerSheet
          listed={new Set(list.map((b) => b.material.id))}
          onClose={() => setSheet(null)}
          onPick={addBook}
        />
      )}
      {sheet?.kind === "upload" && (
        <AddBookModal publicOnly categories={categories} onClose={() => setSheet(null)} onUploaded={(book) => void addBook(book.materialId).catch(() => {})} />
      )}
      {sheet?.kind === "dates" && (
        <DateRangeSheet
          title={`Dates for ${sheet.book.material.title}`}
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

"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import Reader from "./Reader";
import Loader from "../Loader";
import type { BookDocument, BookMetadata } from "@/lib/book/schema";

/** Fetches a book's book.json from the CDN, then mounts Reader on it. The
 * server sends only `bookUrl` and `metadata`, from the materials row, which
 * wins over the document's own (a reader can retitle their upload; the cover
 * cascade lives on the row). */
export default function BookReader({
  bookUrl,
  metadata,
  ...props
}: Omit<ComponentProps<typeof Reader>, "book"> & { bookUrl: string; metadata: BookMetadata }) {
  const [loaded, setLoaded] = useState<{ url: string; book: BookDocument } | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(bookUrl)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`book.json: ${res.status}`))))
      .then((book: BookDocument) => !cancelled && setLoaded({ url: bookUrl, book }))
      .catch((err: Error) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [bookUrl]);

  const book = useMemo(
    () => (loaded?.url === bookUrl ? { ...loaded.book, metadata } : null),
    [loaded, bookUrl, metadata]
  );

  if (error) throw error;
  if (!book) return <Loader />;
  return <Reader key={bookUrl} book={book} {...props} />;
}

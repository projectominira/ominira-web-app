"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { useBookRequest } from "@/lib/materials/useBookRequest";
import { formatTimeAgo } from "@/lib/reader/timeAgo";
import { REQUEST_LIMITS, REQUEST_STATUS_LABEL, type BookRequest } from "@/lib/materials/suggestions";

const STATUS_CLASS: Record<BookRequest["status"], string> = {
  pending: "text-brand-500",
  approved: "text-emerald-600",
  declined: "text-[var(--reader-text-subtle)]",
};

/**
 * "Suggest a book" — one box, the reader's own words (a title, an
 * author, a topic, a link). Same shape as SearchModal: full screen on a
 * phone, a card near the top on desktop. Their recent requests and where
 * each one stands sit underneath.
 */
export default function RequestBookModal({ initialText = "", onClose }: { initialText?: string; onClose: () => void }) {
  const [text, setText] = useState(initialText);
  const [mine, setMine] = useState<BookRequest[] | null>(null);
  const { send, state, error, reset } = useBookRequest();

  useEffect(() => {
    apiFetch<{ items: BookRequest[] }>("/materials/suggestions")
      .then((r) => setMine(r.items))
      .catch(() => setMine([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const item = await send(text);
    if (!item) return;
    setMine((list) => [item, ...(list ?? []).filter((r) => r.id !== item.id)]);
    setText("");
  }

  const sent = state === "sent";

  return createPortal(
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/45 md:items-start md:px-6 md:py-16"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-book-title"
        className="flex h-full w-full flex-col overflow-hidden bg-[var(--reader-surface)] shadow-lg md:h-auto md:max-h-[calc(100vh-8rem)] md:max-w-[560px] md:rounded-lg"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex flex-none items-center gap-3 border-b border-[var(--reader-border)] px-5 py-4">
          <h2 id="request-book-title" className="m-0 flex-1 text-[15px] font-bold text-[var(--reader-text)]">
            Suggest a book
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex-none cursor-pointer border-none bg-transparent p-0 text-[var(--reader-text-muted)]">
            <X size={18} />
          </button>
        </div>

        <div className="om-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {sent ? (
            <div role="status" className="flex flex-col items-center py-6 text-center">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10">
                <Check size={20} className="text-emerald-600" />
              </span>
              <p className="m-0 text-[15px] font-bold text-[var(--reader-text)]">Got it — we&rsquo;re on it.</p>
              <p className="m-0 mt-1 max-w-[340px] text-[13px] text-[var(--reader-text-muted)]">
                Most requests are in the library within 30 minutes. We&rsquo;ll let you know the moment it&rsquo;s there.
              </p>
              <button type="button" onClick={reset} className="mt-4 cursor-pointer border-none bg-transparent p-0 text-[13px] font-bold text-brand-500">
                Ask for something else
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <p className="m-0 mb-3 text-[13px] leading-relaxed text-[var(--reader-text-muted)]">
                Are there books that should be in the library? Help the community with your recommendations. Tell us about them, or drop a link (Google Drive, Dropbox, Internet Archive, etc.).
              </p>
              <label htmlFor="request-book-text" className="sr-only">
                What are you looking for?
              </label>
              <textarea
                id="request-book-text"
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
                }}
                rows={4}
                maxLength={REQUEST_LIMITS.text}
                placeholder="A title, an author, a topic or a link"
                aria-invalid={error ? true : undefined}
                className="block w-full resize-none rounded-sm border border-sand-300 bg-[var(--reader-surface)] px-4 py-3 text-[14px] leading-6 text-[var(--reader-text)] outline-none transition-colors placeholder:text-sand-400 focus:border-brand-400"
              />
              {error && (
                <p role="alert" className="m-0 mt-2 text-[12px] font-semibold text-red-500">
                  {error}
                </p>
              )}
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={state === "sending" || !text.trim()}
                  className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-sm border-none bg-brand-500 px-5 text-[13px] font-bold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
                >
                  {state === "sending" && <Loader2 size={14} className="animate-spin" />}
                  {state === "sending" ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          )}

          {mine && mine.length > 0 && (
            <div className="mt-6 border-t border-[var(--reader-border)] pt-4">
              <h3 className="m-0 mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--reader-text-subtle)]">Your requests</h3>
              <ul className="m-0 list-none p-0">
                {mine.map((r) => (
                  <li key={r.id} className="flex items-baseline gap-3 border-b border-[var(--reader-border)] py-2.5 text-[13px] last:border-b-0">
                    <span className="min-w-0 flex-1 truncate text-[var(--reader-text)]">{r.text}</span>
                    <span className="flex-none text-[11px] text-[var(--reader-text-subtle)]">{formatTimeAgo(new Date(r.createdAt).getTime())}</span>
                    <span className={`flex-none text-[11px] font-bold ${STATUS_CLASS[r.status]}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

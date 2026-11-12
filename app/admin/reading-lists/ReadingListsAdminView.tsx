"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import AdminPageHeader from "@/app/admin/AdminPageHeader";
import { AdminSelect } from "@/app/admin/AdminControls";
import TextAreaField from "@/app/components/auth/TextAreaField";
import TextField from "@/app/components/auth/TextField";
import type { AdminReadingList } from "@/lib/readingLists/lists";

const primary =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-sm border-none bg-brand-500 px-4 text-[12px] font-bold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-sm border border-[var(--reader-border)] bg-transparent px-4 text-[12px] font-bold text-[var(--reader-text)] transition-colors hover:bg-[var(--reader-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50";

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Reading lists the connector drafted: edit the words and the day, then
 * approve; the list goes live at 07:00 Lagos on its day. */
export default function ReadingListsAdminView({ approved, lists }: { approved: boolean; lists: AdminReadingList[] }) {
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(new Set());
  const shown = lists.filter((l) => !done.has(l.id));
  return (
    <>
      <AdminPageHeader
        title="Reading lists"
        subtitle={approved ? `${shown.length} approved lists` : `${shown.length} drafts to approve`}
        actions={
          <AdminSelect
            value={approved ? "approved" : "draft"}
            onChange={(v) => router.push(v === "approved" ? "/admin/reading-lists?show=approved" : "/admin/reading-lists")}
            options={[
              { value: "draft", label: "Drafts" },
              { value: "approved", label: "Approved" },
            ]}
            label="Show"
          />
        }
      />
      {shown.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-[var(--reader-text-muted)]">
          {approved ? "No approved lists yet." : "No drafts. Ask your AI, through the Ominira connector, to plan the calendar: it drafts the month's list too."}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {shown.map((l) => (
            <ListCard key={l.id} list={l} approved={approved} onDone={() => setDone((s) => new Set(s).add(l.id))} />
          ))}
        </div>
      )}
    </>
  );
}

function ListCard({ list: l, approved, onDone }: { list: AdminReadingList; approved: boolean; onDone: () => void }) {
  const [title, setTitle] = useState(l.title);
  const [intro, setIntro] = useState(l.intro);
  const [day, setDay] = useState(l.day);
  const [books, setBooks] = useState(l.books);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const setBook = (slug: string, patch: Partial<AdminReadingList["books"][number]>) => setBooks((all) => all.map((b) => (b.slug === slug ? { ...b, ...patch } : b)));

  const save = async (status?: "approved" | "draft" | "none") => {
    setBusy(true);
    setMessage(null);
    try {
      const body = status === "none" ? { status } : { title, intro, day, books: books.map(({ slug, why, tag }) => ({ slug, why, tag })), ...(status && { status }) };
      const response = await fetch(`/api/admin/reading-lists/${l.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Please try again.");
      // Approving a draft, unpublishing or discarding moves it off this list.
      if (status && (status !== "approved" || !approved)) onDone();
      else setMessage("Saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="flex flex-col gap-4 rounded-sm border border-[var(--reader-border)] p-5">
      <header className="flex items-center justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <h2 className="m-0 font-serif text-[20px] font-semibold text-[var(--reader-text)]">{l.title}</h2>
          <span className="text-[12px] font-medium text-[var(--reader-text-muted)]">
            {l.live ? "Live" : `Goes live ${dayLabel(l.day)}, 07:00 Lagos`} · /reading-lists/{l.slug}
            {l.topic && <> · goes deeper: /topics/{l.topic}</>}
          </span>
          {l.occasion && <span className="text-[12px] text-[var(--reader-text-muted)]">{l.occasion}</span>}
        </span>
        {l.live && (
          <Link href={`/reading-lists/${l.slug}`} target="_blank" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]">
            Page <ExternalLink size={12} />
          </Link>
        )}
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextField label="Day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
      </div>
      <TextAreaField label="Introduction" hint={`${words(intro)} words`} rows={6} value={intro} onChange={(e) => setIntro(e.target.value)} />
      {books.map((b, i) => (
        <section key={b.slug} className="flex flex-col gap-3 border-t border-[var(--reader-border)] pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
            <TextAreaField
              label={`${i + 1}. ${b.title}`}
              hint={
                <Link href={`/library/${b.slug}`} target="_blank" className="underline">
                  Book
                </Link>
              }
              rows={3}
              value={b.why}
              onChange={(e) => setBook(b.slug, { why: e.target.value })}
            />
            <TextField label="Label" value={b.tag ?? ""} placeholder="None" onChange={(e) => setBook(b.slug, { tag: e.target.value || null })} />
          </div>
        </section>
      ))}
      <footer className="flex flex-wrap items-center gap-2">
        {approved ? (
          <>
            <button type="button" className={primary} disabled={busy} onClick={() => save()}>Save</button>
            <button type="button" className={secondary} disabled={busy} onClick={() => save("draft")}>Unpublish</button>
          </>
        ) : (
          <>
            <button type="button" className={primary} disabled={busy || !intro.trim()} onClick={() => save("approved")}>Approve</button>
            <button type="button" className={secondary} disabled={busy} onClick={() => save()}>Save draft</button>
            <button type="button" className={secondary} disabled={busy} onClick={() => save("none")}>Discard</button>
          </>
        )}
        {message && <span className="text-[12px] font-semibold text-[var(--reader-text-muted)]">{message}</span>}
      </footer>
    </article>
  );
}

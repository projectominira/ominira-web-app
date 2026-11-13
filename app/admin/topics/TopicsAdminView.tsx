"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import AdminPageHeader from "@/app/admin/AdminPageHeader";
import TextAreaField from "@/app/components/auth/TextAreaField";
import TextField from "@/app/components/auth/TextField";
import type { AdminTopic } from "@/lib/topics/guides";

const primary =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-sm border-none bg-brand-500 px-4 text-[12px] font-bold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-sm border border-[var(--reader-border)] bg-transparent px-4 text-[12px] font-bold text-[var(--reader-text)] transition-colors hover:bg-[var(--reader-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50";

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Topic guides the connector published on /topics/<slug>: edit the words,
 * or remove a guide. */
export default function TopicsAdminView({ topics }: { topics: AdminTopic[] }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const shown = topics.filter((t) => !done.has(t.id));
  return (
    <>
      <AdminPageHeader title="Topics" subtitle={`${shown.length} topic guides`} />
      {shown.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-[var(--reader-text-muted)]">
          No topic guides yet. Ask your AI, through the Ominira connector, to write them.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {shown.map((t) => (
            <TopicCard key={t.id} topic={t} onDone={() => setDone((s) => new Set(s).add(t.id))} />
          ))}
        </div>
      )}
    </>
  );
}

function TopicCard({ topic: t, onDone }: { topic: AdminTopic; onDone: () => void }) {
  const [title, setTitle] = useState(t.title);
  const [intro, setIntro] = useState(t.intro);
  const [stages, setStages] = useState(t.stages);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const setStage = (i: number, patch: Partial<AdminTopic["stages"][number]>) => setStages((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setWhy = (i: number, slug: string, why: string) =>
    setStages((all) => all.map((s, j) => (j === i ? { ...s, books: s.books.map((b) => (b.slug === slug ? { ...b, why } : b)) } : s)));

  const save = async (remove = false) => {
    if (remove && !window.confirm(`Remove the ${t.name} guide from the site?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/topics/${t.id}`, {
        method: remove ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: remove ? undefined : JSON.stringify({ title, intro, stages: stages.map((s) => ({ title: s.title, intro: s.intro, books: s.books.map((b) => ({ slug: b.slug, why: b.why })) })) }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Please try again.");
      if (remove) onDone();
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
          <h2 className="m-0 font-serif text-[20px] font-semibold text-[var(--reader-text)]">{t.name}</h2>
          <span className="text-[12px] font-medium text-[var(--reader-text-muted)]">{t.category ? "Library category" : "Broad topic"} · /topics/{t.slug}</span>
        </span>
        <Link href={`/topics/${t.slug}`} target="_blank" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]">
          Page <ExternalLink size={12} />
        </Link>
      </header>
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <TextAreaField label="Introduction" hint={`${words(intro)} words`} rows={8} value={intro} onChange={(e) => setIntro(e.target.value)} />
      {stages.map((s, i) => (
        <section key={i} className="flex flex-col gap-3 border-t border-[var(--reader-border)] pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
            <TextField label={`Stage ${i + 1}`} value={s.title} onChange={(e) => setStage(i, { title: e.target.value })} />
            <TextField label="What it covers" value={s.intro} onChange={(e) => setStage(i, { intro: e.target.value })} />
          </div>
          {s.books.map((b) => (
            <TextAreaField
              key={b.slug}
              label={b.title}
              hint={
                <Link href={`/library/${b.slug}`} target="_blank" className="underline">
                  Book
                </Link>
              }
              rows={2}
              value={b.why}
              onChange={(e) => setWhy(i, b.slug, e.target.value)}
            />
          ))}
        </section>
      ))}
      <footer className="flex flex-wrap items-center gap-2">
        <button type="button" className={primary} disabled={busy || !intro.trim()} onClick={() => save()}>Save</button>
        <button type="button" className={secondary} disabled={busy} onClick={() => save(true)}>Remove</button>
        {message && <span className="text-[12px] font-semibold text-[var(--reader-text-muted)]">{message}</span>}
      </footer>
    </article>
  );
}

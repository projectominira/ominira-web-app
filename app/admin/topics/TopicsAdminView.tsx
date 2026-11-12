"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import AdminPageHeader from "@/app/admin/AdminPageHeader";
import { AdminSelect } from "@/app/admin/AdminControls";
import TextAreaField from "@/app/components/auth/TextAreaField";
import TextField from "@/app/components/auth/TextField";
import type { AdminTopic } from "@/lib/topics/guides";

const primary =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-sm border-none bg-brand-500 px-4 text-[12px] font-bold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-sm border border-[var(--reader-border)] bg-transparent px-4 text-[12px] font-bold text-[var(--reader-text)] transition-colors hover:bg-[var(--reader-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50";

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Topic guides the connector drafted: edit the words, then approve to
 * publish the guide on /topics/<slug>. */
export default function TopicsAdminView({ approved, topics }: { approved: boolean; topics: AdminTopic[] }) {
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(new Set());
  const shown = topics.filter((t) => !done.has(t.id));
  return (
    <>
      <AdminPageHeader
        title="Topics"
        subtitle={approved ? `${shown.length} approved topic guides` : `${shown.length} drafts to approve`}
        actions={
          <AdminSelect
            value={approved ? "approved" : "draft"}
            onChange={(v) => router.push(v === "approved" ? "/admin/topics?show=approved" : "/admin/topics")}
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
          {approved ? "No approved topic guides yet." : "No drafts. Ask your AI, through the Ominira connector, to write the topic guides."}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {shown.map((t) => (
            <TopicCard key={t.id} topic={t} approved={approved} onDone={() => setDone((s) => new Set(s).add(t.id))} />
          ))}
        </div>
      )}
    </>
  );
}

function TopicCard({ topic: t, approved, onDone }: { topic: AdminTopic; approved: boolean; onDone: () => void }) {
  const [title, setTitle] = useState(t.title);
  const [intro, setIntro] = useState(t.intro);
  const [stages, setStages] = useState(t.stages);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const setStage = (i: number, patch: Partial<AdminTopic["stages"][number]>) => setStages((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setWhy = (i: number, slug: string, why: string) =>
    setStages((all) => all.map((s, j) => (j === i ? { ...s, books: s.books.map((b) => (b.slug === slug ? { ...b, why } : b)) } : s)));

  const save = async (status?: "approved" | "draft" | "none") => {
    setBusy(true);
    setMessage(null);
    try {
      const body =
        status === "none"
          ? { status }
          : { title, intro, stages: stages.map((s) => ({ title: s.title, intro: s.intro, books: s.books.map((b) => ({ slug: b.slug, why: b.why })) })), ...(status && { status }) };
      const response = await fetch(`/api/admin/topics/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
          <h2 className="m-0 font-serif text-[20px] font-semibold text-[var(--reader-text)]">{t.name}</h2>
          <span className="text-[12px] font-medium text-[var(--reader-text-muted)]">{t.category ? "Library category" : "Broad topic"} · /topics/{t.slug}</span>
        </span>
        {(approved || t.category) && (
          <Link href={`/topics/${t.slug}`} target="_blank" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]">
            Page <ExternalLink size={12} />
          </Link>
        )}
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

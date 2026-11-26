"use client";

import Link from "next/link";
import { useState } from "react";
import TextAreaField from "@/app/components/auth/TextAreaField";
import TextField from "@/app/components/auth/TextField";
import type { AdminTopic } from "@/lib/topics/guides";
import { AiList, PageLink, PanelFooter, patch, words } from "../shared";

const books = (t: AdminTopic) => t.stages.reduce((n, s) => n + s.books.length, 0);

/** Topic guides the AI wrote: live on /topics/<slug> from the start. */
export default function TopicsAdminView({ topics: initial }: { topics: AdminTopic[] }) {
  const [topics, setTopics] = useState(initial);
  const update = (next: AdminTopic) => setTopics((all) => all.map((t) => (t.id === next.id ? next : t)));
  return (
    <AiList
      items={topics}
      noun={["topic guide", "topic guides"]}
      empty="No topic guides yet. Ask your AI, through the connector, to write them."
      row={(t) => ({
        id: t.id,
        title: t.name,
        detail: `${t.category ? "Library category" : "Broad topic"} · ${books(t)} books`,
        off: !t.live,
        search: `${t.name} ${t.title}`,
      })}
      panel={(t) => ({ title: t.name, subtitle: t.live ? "On the site" : "Off the site", body: <TopicEditor topic={t} onChange={update} /> })}
    />
  );
}

function TopicEditor({ topic: t, onChange }: { topic: AdminTopic; onChange: (t: AdminTopic) => void }) {
  const [title, setTitle] = useState(t.title);
  const [intro, setIntro] = useState(t.intro);
  const [stages, setStages] = useState(t.stages);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const setStage = (i: number, patch: Partial<AdminTopic["stages"][number]>) => setStages((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setWhy = (i: number, slug: string, why: string) =>
    setStages((all) => all.map((s, j) => (j === i ? { ...s, books: s.books.map((b) => (b.slug === slug ? { ...b, why } : b)) } : s)));

  const send = async (body: object, next: AdminTopic, done: string) => {
    setBusy(true);
    setMessage(null);
    const error = await patch(`/api/admin/topics/${t.id}`, body);
    setBusy(false);
    setMessage(error ?? done);
    if (!error) onChange(next);
  };

  const save = () =>
    send({ title, intro, stages: stages.map((s) => ({ title: s.title, intro: s.intro, books: s.books.map((b) => ({ slug: b.slug, why: b.why })) })) }, { ...t, title, intro, stages }, "Saved.");
  const toggle = () => send({ status: t.live ? "draft" : "approved" }, { ...t, live: !t.live }, t.live ? "Taken off the site." : "Back on the site.");

  return (
    <>
      <PageLink href={`/topics/${t.slug}`} />
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <TextAreaField label="Introduction" hint={`${words(intro)} words`} rows={9} value={intro} onChange={(e) => setIntro(e.target.value)} />
      {stages.map((s, i) => (
        <section key={i} className="flex flex-col gap-3 border-t border-[var(--reader-border)] pt-4">
          <TextField label={`Stage ${i + 1}`} value={s.title} onChange={(e) => setStage(i, { title: e.target.value })} />
          <TextField label="What it covers" value={s.intro} onChange={(e) => setStage(i, { intro: e.target.value })} />
          {s.books.map((b) => (
            <TextAreaField
              key={b.slug}
              label={b.title}
              hint={
                <Link href={`/library/${b.slug}`} target="_blank" className="underline">
                  Book
                </Link>
              }
              rows={3}
              value={b.why}
              onChange={(e) => setWhy(i, b.slug, e.target.value)}
            />
          ))}
        </section>
      ))}
      <PanelFooter busy={busy} off={!t.live} canSave={!!intro.trim()} message={message} onSave={save} onToggle={toggle} />
    </>
  );
}

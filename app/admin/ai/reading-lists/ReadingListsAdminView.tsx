"use client";

import Link from "next/link";
import { useState } from "react";
import TextAreaField from "@/app/components/auth/TextAreaField";
import TextField from "@/app/components/auth/TextField";
import type { AdminReadingList } from "@/lib/readingLists/lists";
import { AiList, PageLink, PanelFooter, patch, words } from "../shared";

const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Reading lists the AI wrote: each goes live at 07:00 Lagos on its day. */
export default function ReadingListsAdminView({ lists: initial }: { lists: AdminReadingList[] }) {
  const [lists, setLists] = useState(initial);
  const update = (next: AdminReadingList) => setLists((all) => all.map((l) => (l.id === next.id ? next : l)));
  const on = (l: AdminReadingList) => l.status === "approved";
  return (
    <AiList
      items={lists}
      noun={["reading list", "reading lists"]}
      empty="No reading lists yet. Ask your AI, through the connector, to plan the calendar: it writes the month's list too."
      row={(l) => ({
        id: l.id,
        title: l.title,
        detail: `${dayLabel(l.day)} · ${l.books.length} books`,
        off: !on(l),
        note: on(l) && !l.live ? "Scheduled" : undefined,
        search: `${l.title} ${l.occasion}`,
      })}
      panel={(l) => ({
        title: l.title,
        subtitle: !on(l) ? "Off the site" : l.live ? "On the site" : `Goes live ${dayLabel(l.day)}, 07:00 Lagos`,
        body: <ListEditor list={l} onChange={update} />,
      })}
    />
  );
}

function ListEditor({ list: l, onChange }: { list: AdminReadingList; onChange: (l: AdminReadingList) => void }) {
  const [title, setTitle] = useState(l.title);
  const [intro, setIntro] = useState(l.intro);
  const [day, setDay] = useState(l.day);
  const [books, setBooks] = useState(l.books);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const off = l.status !== "approved";

  const setBook = (slug: string, patch: Partial<AdminReadingList["books"][number]>) => setBooks((all) => all.map((b) => (b.slug === slug ? { ...b, ...patch } : b)));

  const send = async (body: object, next: AdminReadingList, done: string) => {
    setBusy(true);
    setMessage(null);
    const error = await patch(`/api/admin/reading-lists/${l.id}`, body);
    setBusy(false);
    setMessage(error ?? done);
    if (!error) onChange(next);
  };

  const save = () => send({ title, intro, day, books: books.map(({ slug, why, tag }) => ({ slug, why, tag })) }, { ...l, title, intro, day, books }, "Saved.");
  const toggle = () => {
    const status = off ? "approved" : "draft";
    return send({ status }, { ...l, status }, off ? "Back on the site." : "Taken off the site.");
  };

  return (
    <>
      {l.live && !off && <PageLink href={`/reading-lists/${l.slug}`} />}
      {l.occasion && <p className="m-0 text-[12px] font-medium text-[var(--reader-text-muted)]">{l.occasion}</p>}
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <TextField label="Day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
      <TextAreaField label="Introduction" hint={`${words(intro)} words`} rows={7} value={intro} onChange={(e) => setIntro(e.target.value)} />
      {books.map((b, i) => (
        <section key={b.slug} className="flex flex-col gap-3 border-t border-[var(--reader-border)] pt-4">
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
        </section>
      ))}
      <PanelFooter busy={busy} off={off} canSave={!!intro.trim()} message={message} onSave={save} onToggle={toggle} />
    </>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import TextAreaField from "@/app/components/auth/TextAreaField";
import TextField from "@/app/components/auth/TextField";
import type { AdminAuthor } from "@/lib/authors/authors";
import { AiList, PageLink, PanelFooter, patch, words } from "../shared";

const years = (a: AdminAuthor) => (a.born || a.died ? `${a.born ?? "?"}–${a.died ?? ""}` : "");

function Portrait({ src, size }: { src: string | null; size: string }) {
  return (
    <span className={`flex ${size} flex-none items-center justify-center overflow-hidden rounded-full bg-[var(--reader-surface-hover)]`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt="" className="size-full object-cover object-top" />}
    </span>
  );
}

/** Author pages the AI wrote: live on /authors/<slug> from the start. */
export default function AuthorsAdminView({ authors: initial }: { authors: AdminAuthor[] }) {
  const [authors, setAuthors] = useState(initial);
  const update = (next: AdminAuthor) => setAuthors((all) => all.map((a) => (a.id === next.id ? next : a)));
  return (
    <AiList
      items={authors}
      noun={["author page", "author pages"]}
      empty="No author pages yet. Ask your AI, through the connector, to write them."
      row={(a) => ({
        id: a.id,
        title: a.name,
        detail: [a.role, years(a)].filter(Boolean).join(" · ") || `${words(a.bio)} words`,
        off: a.status !== "approved",
        leading: <Portrait src={a.image} size="size-9" />,
        search: `${a.name} ${a.role} ${a.places}`,
      })}
      panel={(a) => ({ title: a.name, subtitle: a.status === "approved" ? "On the site" : "Off the site", body: <AuthorEditor author={a} onChange={update} /> })}
    />
  );
}

function AuthorEditor({ author: a, onChange }: { author: AdminAuthor; onChange: (a: AdminAuthor) => void }) {
  const [bio, setBio] = useState(a.bio);
  const [role, setRole] = useState(a.role);
  const [places, setPlaces] = useState(a.places);
  const [born, setBorn] = useState(a.born?.toString() ?? "");
  const [died, setDied] = useState(a.died?.toString() ?? "");
  const [image, setImage] = useState(a.image ?? "");
  const [credit, setCredit] = useState(a.imageCredit);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const off = a.status !== "approved";

  const year = (v: string) => (v.trim() ? Number.parseInt(v, 10) : null);

  const send = async (body: object, next: AdminAuthor, done: string) => {
    setBusy(true);
    setMessage(null);
    const error = await patch(`/api/admin/authors/${a.id}`, body);
    setBusy(false);
    setMessage(error ?? done);
    if (!error) onChange(next);
  };

  const save = () => {
    const fields = { bio, role, places, born: year(born), died: year(died), image_url: image.trim() || null, image_credit: credit };
    return send(fields, { ...a, ...fields, image: fields.image_url, imageCredit: credit }, "Saved.");
  };
  const toggle = () => {
    const status = off ? "approved" : "draft";
    return send({ status }, { ...a, status }, off ? "Back on the site." : "Taken off the site.");
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <Portrait src={image.trim() || null} size="size-14" />
        <PageLink href={`/authors/${a.slug}`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Born" inputMode="numeric" value={born} onChange={(e) => setBorn(e.target.value)} />
        <TextField label="Died" inputMode="numeric" value={died} onChange={(e) => setDied(e.target.value)} />
      </div>
      <TextField label="Role" value={role} onChange={(e) => setRole(e.target.value)} />
      <TextField label="Places" value={places} onChange={(e) => setPlaces(e.target.value)} />
      <TextAreaField label="Bio" hint={`${words(bio)} words`} rows={9} value={bio} onChange={(e) => setBio(e.target.value)} />
      <TextField label="Image" hint="Wikimedia Commons" value={image} onChange={(e) => setImage(e.target.value)} />
      <TextField label="Image credit" value={credit} onChange={(e) => setCredit(e.target.value)} />
      <div className="flex flex-col gap-1 text-[12px] font-medium text-[var(--reader-text-muted)]">
        <span>
          Sources:{" "}
          {a.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ", "}
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                {s.title}
              </a>
            </span>
          ))}
          {a.wikidataId && <> · Wikidata {a.wikidataId}</>}
        </span>
        {a.alongside.length > 0 && (
          <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
            <li>Read alongside:</li>
            {a.alongside.map((b) => (
              <li key={b.slug}>
                <Link href={`/library/${b.slug}`} target="_blank" className="underline">
                  {b.slug}
                </Link>{" "}
                — {b.why}
              </li>
            ))}
          </ul>
        )}
      </div>
      <PanelFooter busy={busy} off={off} canSave={!!bio.trim()} message={message} onSave={save} onToggle={toggle} />
    </>
  );
}

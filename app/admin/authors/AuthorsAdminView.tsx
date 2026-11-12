"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import AdminPageHeader from "@/app/admin/AdminPageHeader";
import { AdminSelect } from "@/app/admin/AdminControls";
import TextAreaField from "@/app/components/auth/TextAreaField";
import TextField from "@/app/components/auth/TextField";
import type { AdminAuthor } from "@/lib/authors/authors";

const primary =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-sm border-none bg-brand-500 px-4 text-[12px] font-bold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-sm border border-[var(--reader-border)] bg-transparent px-4 text-[12px] font-bold text-[var(--reader-text)] transition-colors hover:bg-[var(--reader-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50";

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Author pages the connector drafted: edit, then approve to publish the bio,
 * facts and "read alongside" on /authors/<slug>. */
export default function AuthorsAdminView({ approved, authors }: { approved: boolean; authors: AdminAuthor[] }) {
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(new Set());
  const shown = authors.filter((a) => !done.has(a.id));
  return (
    <>
      <AdminPageHeader
        title="Authors"
        subtitle={approved ? `${shown.length} approved author pages` : `${shown.length} drafts to approve`}
        actions={
          <AdminSelect
            value={approved ? "approved" : "draft"}
            onChange={(v) => router.push(v === "approved" ? "/admin/authors?show=approved" : "/admin/authors")}
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
          {approved ? "No approved author pages yet." : "No drafts. Ask your AI, through the Ominira connector, to write the author pages."}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {shown.map((a) => (
            <AuthorCard key={a.id} author={a} approved={approved} onDone={() => setDone((s) => new Set(s).add(a.id))} />
          ))}
        </div>
      )}
    </>
  );
}

function AuthorCard({ author: a, approved, onDone }: { author: AdminAuthor; approved: boolean; onDone: () => void }) {
  const [bio, setBio] = useState(a.bio);
  const [role, setRole] = useState(a.role);
  const [places, setPlaces] = useState(a.places);
  const [born, setBorn] = useState(a.born?.toString() ?? "");
  const [died, setDied] = useState(a.died?.toString() ?? "");
  const [image, setImage] = useState(a.image ?? "");
  const [credit, setCredit] = useState(a.imageCredit);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const year = (v: string) => (v.trim() ? Number.parseInt(v, 10) : null);

  const save = async (status?: "approved" | "draft" | "none") => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/authors/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(status === "none" ? { status } : { bio, role, places, born: year(born), died: year(died), image_url: image.trim() || null, image_credit: credit, ...(status && { status }) }),
      });
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
        <span className="flex items-center gap-3">
          <span className="flex size-14 flex-none items-center justify-center overflow-hidden rounded-full bg-[var(--reader-surface-hover)] text-[11px] font-semibold text-[var(--reader-text-muted)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {image.trim() ? <img src={image.trim()} alt="" className="size-full object-cover object-top" /> : "No image"}
          </span>
          <h2 className="m-0 font-serif text-[20px] font-semibold text-[var(--reader-text)]">{a.name}</h2>
        </span>
        <Link href={`/authors/${a.slug}`} target="_blank" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]">
          Page <ExternalLink size={12} />
        </Link>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[96px_96px_minmax(0,1fr)_minmax(0,1fr)]">
        <TextField label="Born" inputMode="numeric" value={born} onChange={(e) => setBorn(e.target.value)} />
        <TextField label="Died" inputMode="numeric" value={died} onChange={(e) => setDied(e.target.value)} />
        <TextField label="Role" value={role} onChange={(e) => setRole(e.target.value)} />
        <TextField label="Places" value={places} onChange={(e) => setPlaces(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Image" hint="Wikimedia Commons" value={image} onChange={(e) => setImage(e.target.value)} />
        <TextField label="Image credit" value={credit} onChange={(e) => setCredit(e.target.value)} />
      </div>
      <TextAreaField label="Bio" hint={`${words(bio)} words`} rows={7} value={bio} onChange={(e) => setBio(e.target.value)} />
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
      <footer className="flex flex-wrap items-center gap-2">
        {approved ? (
          <>
            <button type="button" className={primary} disabled={busy} onClick={() => save()}>Save</button>
            <button type="button" className={secondary} disabled={busy} onClick={() => save("draft")}>Unpublish</button>
          </>
        ) : (
          <>
            <button type="button" className={primary} disabled={busy || !bio.trim()} onClick={() => save("approved")}>Approve</button>
            <button type="button" className={secondary} disabled={busy} onClick={() => save()}>Save draft</button>
            <button type="button" className={secondary} disabled={busy} onClick={() => save("none")}>Discard</button>
          </>
        )}
        {message && <span className="text-[12px] font-semibold text-[var(--reader-text-muted)]">{message}</span>}
      </footer>
    </article>
  );
}

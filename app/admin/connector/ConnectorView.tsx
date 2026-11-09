"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowRight, Check, Copy, Quote, Tags } from "lucide-react";
import AdminPageHeader from "../AdminPageHeader";
import { BUTTON, PRIMARY } from "../passage/QuoteCard";
import { showToast } from "@/stores/toast-store";

type App = "Claude" | "ChatGPT";

/** Each app's steps; `link` marks the step where the link is pasted, which
 * gets its own Copy button. */
const SETUP: Record<App, { text: ReactNode; link?: boolean }[]> = {
  Claude: [
    { text: <><b>Settings → Connectors</b>, then <b>Add custom connector</b>.</> },
    { text: <>Name it <b>Ominira</b>, paste the link and choose <b>Add</b>. There’s no sign-in.</>, link: true },
    { text: <>In a chat, open the tools menu and turn on <b>Ominira</b>.</> },
  ],
  ChatGPT: [
    { text: <><b>Settings → Apps &amp; Connectors → Advanced settings</b>, and turn on <b>Developer mode</b>.</> },
    { text: <>Back in Apps &amp; Connectors, choose <b>Create</b>, paste the link and set Authentication to <b>No authentication</b>.</>, link: true },
    { text: <>In a chat, pick <b>Developer mode</b> from the <b>+</b> menu and turn on <b>Ominira</b>.</> },
  ],
};

const USES: { job: string; icon: ReactNode; does: string; examples: string[]; review: { href: string; label: string } }[] = [
  {
    job: "Passages",
    icon: <Quote size={16} />,
    does: "Plans the next 30 days on its own: anniversaries, topical days and evergreen passages from the library, following the editorial brief. Or finds quotes for an idea you give it.",
    examples: ["Plan the next 30 days of passages.", "Find three short quotes on land and labour for the passage of the day.", "Send the ones we picked to Ominira."],
    review: { href: "/admin/passage?tab=review", label: "Review in Passages" },
  },
  {
    job: "Tagging books",
    icon: <Tags size={16} />,
    does: "Reads each book’s details, sets its categories and adds new categories when you agree.",
    examples: [
      "Tag the untagged books in Ominira.",
      "Review the tags on every book and fix ones that look wrong.",
      "Do we need more categories? Suggest some, with the books that would go in each.",
    ],
    review: { href: "/admin/library", label: "See tags in Library" },
  },
];

const EYEBROW = "m-0 text-ui-xs tracking-eyebrow uppercase text-[var(--reader-text-subtle)]";
const CARD = "rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)]";

/** Copies `text`, showing a tick for 2s. */
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied((c) => (c === text ? null : c)), 2000);
  };
  return { copied, copy };
}

export default function ConnectorView({ url, brief: initialBrief }: { url: string | null; brief: { body: string; updatedAt: string | null } }) {
  const [app, setApp] = useState<App>("Claude");
  const { copied, copy } = useCopy();
  const [brief, setBrief] = useState(initialBrief.body);
  const [saved, setSaved] = useState(initialBrief);
  const [saving, setSaving] = useState(false);

  const saveBrief = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/passage/brief", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: brief }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Please try again.");
      setSaved({ body: brief.trim(), updatedAt: data.updatedAt });
      showToast("Brief saved. Your AI reads it next time it plans.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };
  const linkCopied = url !== null && copied === url;

  return (
    <div className="flex max-w-[720px] flex-col gap-10">
      <AdminPageHeader title="Connector" subtitle="Add Ominira to Claude or ChatGPT, so your AI can find passages and tag books." />

      <section className="-mt-8 flex flex-col gap-3">
        {!url && (
          <p className="m-0 rounded-sm bg-[var(--reader-surface-hover)] px-3 py-2 text-ui-sm text-[var(--reader-text)]">
            Not set up: add PASSAGE_CONNECTOR_TOKEN to the environment to get a link.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={EYEBROW}>Set up</h2>
          <div role="tablist" aria-label="App" className="flex h-9 overflow-hidden rounded-sm border border-sand-300 bg-[var(--reader-surface)] p-0.5">
            {(Object.keys(SETUP) as App[]).map((a) => (
              <button
                key={a}
                type="button"
                role="tab"
                aria-selected={a === app}
                onClick={() => setApp(a)}
                className={`cursor-pointer rounded-[3px] border-none px-3 text-[13px] font-semibold transition-colors ${
                  a === app ? "bg-[var(--reader-surface-hover)] text-[var(--reader-text)]" : "bg-transparent text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <ol role="tabpanel" aria-label={`Set up in ${app}`} className={`${CARD} m-0 flex list-none flex-col p-0`}>
          {[...SETUP[app], { text: <>Check it works: ask <b>“What’s in the Ominira library?”</b></> }].map((step, i) => (
            <li key={`${app}-${i}`} className="flex gap-3 border-t border-[var(--reader-border)] px-4 py-3 first:border-t-0">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--reader-surface-hover)] text-[12px] font-bold text-[var(--reader-text)] tabular-nums">
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 pt-0.5 text-ui-sm text-[var(--reader-text-muted)] [&_b]:font-semibold [&_b]:text-[var(--reader-text)]">
                <span>{step.text}</span>
                {"link" in step && step.link && url && (
                  <button type="button" onClick={() => copy(url)} className={`${BUTTON} h-8`}>
                    {linkCopied ? <Check size={14} /> : <Copy size={14} />} {linkCopied ? "Copied" : "Copy link"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={EYEBROW}>What it can do</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {USES.map(({ job, icon, does, examples, review }) => (
            <div key={job} className={`${CARD} flex flex-col gap-3 p-4`}>
              <div className="flex flex-col gap-1">
                <h3 className="m-0 flex items-center gap-2 text-[14px] font-semibold text-[var(--reader-text)]">
                  <span className="text-brand-500">{icon}</span>
                  {job}
                </h3>
                <p className="m-0 text-ui-sm text-[var(--reader-text-muted)]">{does}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-ui-caption font-semibold text-[var(--reader-text-subtle)]">Try asking</span>
                {examples.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => copy(e)}
                    title="Copy"
                    className="group flex cursor-pointer items-start gap-2 rounded-sm border-none bg-[var(--reader-bg)] px-3 py-2 text-left text-ui-sm text-[var(--reader-text)] transition-colors hover:bg-[var(--reader-surface-hover)]"
                  >
                    <span className="flex-1">“{e}”</span>
                    <span className="mt-0.5 flex-none text-[var(--reader-text-subtle)] opacity-60 group-hover:opacity-100">
                      {copied === e ? <Check size={13} /> : <Copy size={13} />}
                    </span>
                  </button>
                ))}
              </div>
              <Link href={review.href} className="mt-auto inline-flex items-center gap-1 text-ui-sm font-semibold text-brand-500 no-underline hover:underline">
                {review.label} <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={EYEBROW}>Editorial brief</h2>
        <p className="m-0 text-ui-sm text-[var(--reader-text-muted)]">
          Your AI reads this before it plans passages: the taste to follow and the key dates to mark.
        </p>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          maxLength={4000}
          rows={12}
          aria-label="Editorial brief"
          className="resize-y rounded-sm border border-sand-300 bg-[var(--reader-bg)] px-3 py-2 text-[13px]/[1.55] text-[var(--reader-text)] outline-none focus:border-brand-400"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-ui-caption text-[var(--reader-text-muted)]">
            {saved.updatedAt
              ? `Last changed ${new Date(saved.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
              : "The default brief"}
          </span>
          <button type="button" disabled={saving || !brief.trim() || brief.trim() === saved.body} onClick={saveBrief} className={PRIMARY}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={EYEBROW}>Good to know</h2>
        <ul className="m-0 flex flex-col gap-1.5 pl-5 text-ui-sm text-[var(--reader-text-muted)]">
          <li>Asked to plan, your AI sends its picks straight to To review. Otherwise it shows you first and only saves when you ask.</li>
          <li>Quotes must match the book word for word; any that don’t are turned back with a reason.</li>
          <li>It can’t publish anything. Approved passages go out at 07:00 Lagos time on their day.</li>
          <li>Keep the link private: anyone with it can use the connector. Changing PASSAGE_CONNECTOR_TOKEN revokes it.</li>
        </ul>
      </section>
    </div>
  );
}

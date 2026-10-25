"use client";

import { useState } from "react";
import { Check, Copy, Plug } from "lucide-react";
import { BUTTON } from "./QuoteCard";

const STEPS: { app: string; steps: string[] }[] = [
  {
    app: "Claude",
    steps: [
      "Settings → Connectors → Add custom connector.",
      "Name it “Ominira”, paste the link, and choose Add. There’s no sign-in.",
      "In a chat, turn on Ominira from the tools menu, then describe the passages you’re after.",
    ],
  },
  {
    app: "ChatGPT",
    steps: [
      "Settings → Apps & Connectors → Advanced settings, and turn on Developer mode.",
      "Back in Apps & Connectors, choose Create, paste the link, and set Authentication to No authentication.",
      "In a chat, pick Developer mode from the + menu and turn on Ominira.",
    ],
  },
];

/** "Connect your AI" (passage-spec §6.2): the connector link and how to add
 * it to Claude or ChatGPT. */
export default function ConnectPanel({ url }: { url: string | null }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={BUTTON}>
        <Plug size={14} /> Connect your AI
      </button>
      {open && (
        <div onClick={() => setOpen(false)} className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-title"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-[520px] flex-col gap-5 overflow-y-auto rounded-sm bg-[var(--reader-surface)] p-5 shadow-lg"
          >
            <div className="flex flex-col gap-1">
              <h2 id="connect-title" className="m-0 font-serif text-[16px] font-semibold text-[var(--reader-text)]">
                Connect your AI
              </h2>
              <p className="m-0 text-ui-sm text-[var(--reader-text-muted)]">
                Add Ominira to Claude or ChatGPT. Your AI can then search and read the library, and send the quotes you settle on here as a set.
              </p>
            </div>

            {url ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-ui-xs tracking-eyebrow uppercase text-[var(--reader-text-subtle)]">Connector link</span>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={url}
                    onFocus={(e) => e.target.select()}
                    className="min-w-0 flex-1 rounded-sm border border-sand-300 bg-[var(--reader-bg)] px-3 py-2 font-mono text-[12px] text-[var(--reader-text)] outline-none"
                  />
                  <button type="button" onClick={copy} className={BUTTON}>
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="m-0 text-ui-caption text-[var(--reader-text-muted)]">
                  Keep it private. It can read the library and add sets, nothing else: publishing still needs an admin. Changing PASSAGE_CONNECTOR_TOKEN revokes it.
                </p>
              </div>
            ) : (
              <p className="m-0 rounded-sm bg-[var(--reader-surface-hover)] px-3 py-2 text-ui-sm text-[var(--reader-text)]">
                Not set up: add PASSAGE_CONNECTOR_TOKEN to the environment to get a link.
              </p>
            )}

            {STEPS.map(({ app, steps }) => (
              <section key={app} className="flex flex-col gap-1.5">
                <h3 className="m-0 text-[14px] font-semibold text-[var(--reader-text)]">{app}</h3>
                <ol className="m-0 flex flex-col gap-1 pl-5 text-ui-sm font-normal text-[var(--reader-text-muted)]">
                  {steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </section>
            ))}

            <div className="flex justify-end">
              <button type="button" onClick={() => setOpen(false)} className={BUTTON}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

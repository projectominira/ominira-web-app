"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { shortDayTime } from "@/lib/time/adminFormat";
import { ChevronDown, ChevronRight, CircleCheck, CornerUpLeft, ExternalLink } from "lucide-react";

export type SentRow = {
  id: string;
  kind: "message" | "reading_list";
  title: string;
  body: string;
  url: string;
  channels: ("push" | "email")[];
  audience: "everyone" | "opted_in";
  status: "scheduled" | "sending" | "sent" | "stopped";
  send_at: string;
  recipient_count: number;
  failure_count: number;
  email_recipient_count: number;
  email_sent_count: number;
  email_failure_count: number;
};

const n = (count: number) => count.toLocaleString("en");
const when = (iso: string) => shortDayTime(new Date(iso));
const button =
  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-[var(--reader-border)] bg-transparent px-3 text-[12px] font-bold text-[var(--reader-text)] no-underline transition-colors hover:bg-[var(--reader-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50";

function status(b: SentRow): { text: string; live?: boolean } {
  if (b.status === "scheduled") return { text: `Scheduled · ${when(b.send_at)}`, live: true };
  if (b.status === "sending") return { text: "Sending email · more each day", live: true };
  if (b.status === "stopped") return { text: "Stopped" };
  return { text: "Sent" };
}

function channels(b: SentRow): string[] {
  const started = b.status !== "scheduled";
  const lines: string[] = [];
  if (b.channels.includes("push")) lines.push(started ? `App · ${n(b.recipient_count - b.failure_count)} devices` : "App");
  if (b.channels.includes("email")) {
    const who = b.audience === "everyone" ? "everyone" : "opted in";
    lines.push(started ? `Email · ${n(b.email_sent_count)} of ${n(b.email_recipient_count)}` : `Email · ${who}`);
  }
  return lines;
}

/** /admin/push/sent: what's gone out and what's scheduled, newest first;
 * email still going out shows how far it's got, and can be stopped. */
export default function SentView({ broadcasts, sentId }: { broadcasts: SentRow[]; sentId: string | null }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const just = sentId ? broadcasts.find((b) => b.id === sentId) : undefined;

  const stop = async (b: SentRow) => {
    if (!window.confirm(b.status === "scheduled" ? `Cancel “${b.title}”? Nothing will be sent.` : `Stop the emails “${b.title}” hasn’t sent yet?`)) return;
    setBusy(b.id);
    setError(null);
    const res = await fetch(`/api/admin/push/broadcast/${b.id}`, { method: "DELETE" }).catch(() => null);
    setBusy(null);
    if (!res?.ok) setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn’t stop it. Try again.");
    router.refresh();
  };

  return (
    <div>
      {just && (
        <p role="status" className="m-0 mb-4 flex items-center gap-1.5 rounded-sm border border-[var(--reader-border)] px-4 py-3 text-[13px] font-semibold text-[var(--reader-text)]">
          <CircleCheck size={15} className="flex-none text-emerald-500" aria-hidden />
          {just.status === "scheduled" ? `Scheduled “${just.title}” for ${when(just.send_at)}.` : `Sent “${just.title}”. ${channels(just).join(" · ")}.`}
        </p>
      )}
      {error && <p className="m-0 mb-4 text-[13px] font-semibold text-red-600">{error}</p>}

      {broadcasts.length === 0 ? (
        <p className="m-0 rounded-sm border border-[var(--reader-border)] px-5 py-10 text-center text-sm text-[var(--reader-text-muted)]">Nothing sent yet.</p>
      ) : (
        <ul className="m-0 list-none border-t border-[var(--reader-border)] p-0">
          {broadcasts.map((b) => {
            const s = status(b);
            const open = openId === b.id;
            const Chevron = open ? ChevronDown : ChevronRight;
            const failed = b.email_failure_count;
            return (
              <li key={b.id} className="border-b border-[var(--reader-border)]">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_170px_220px_20px]">
                  <button type="button" onClick={() => setOpenId(open ? null : b.id)} aria-expanded={open} className="min-w-0 cursor-pointer border-none bg-transparent p-0 text-left">
                    <span className="block truncate text-[14px] font-semibold text-[var(--reader-text)]">{b.title}</span>
                    <span className="mt-0.5 block truncate text-[12px] font-medium text-[var(--reader-text-muted)]">
                      {when(b.send_at)}
                      {b.kind === "reading_list" && " · with a reading list"}
                      {failed > 0 && ` · ${n(failed)} emails failed`}
                    </span>
                  </button>
                  <span className="hidden flex-col gap-1 text-[12px] font-semibold text-[var(--reader-text-muted)] sm:flex">
                    {channels(b).map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </span>
                  <span className="flex flex-col items-end gap-1.5 sm:items-start">
                    <span className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[11px] font-bold ${s.live ? "border-brand-500/30 text-brand-500" : "border-[var(--reader-border)] text-[var(--reader-text-muted)]"}`}>{s.text}</span>
                    {(b.status === "scheduled" || b.status === "sending") && (
                      <button type="button" disabled={busy === b.id} onClick={() => stop(b)} className="cursor-pointer border-none bg-transparent p-0 text-[12px] font-semibold text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]">
                        {b.status === "scheduled" ? "Cancel" : "Stop the rest"}
                      </button>
                    )}
                  </span>
                  <Chevron size={15} className="hidden text-[var(--reader-text-subtle)] sm:block" />
                </div>
                {open && (
                  <div className="flex flex-col gap-3 px-2 pb-5">
                    <p className="m-0 max-w-prose whitespace-pre-line text-[13px] leading-relaxed text-[var(--reader-text-muted)]">{b.body}</p>
                    <p className="m-0 text-[12px] font-semibold text-[var(--reader-text-muted)] sm:hidden">{channels(b).join(" · ")}</p>
                    {b.url && (
                      <a href={b.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 self-start break-all text-[12px] font-semibold text-[var(--reader-text)] hover:underline">
                        {b.url} <ExternalLink size={12} className="flex-none" />
                      </a>
                    )}
                    <Link href={`/admin/push?reuse=${b.id}`} className={`${button} self-start`}>
                      <CornerUpLeft size={14} /> Reuse
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

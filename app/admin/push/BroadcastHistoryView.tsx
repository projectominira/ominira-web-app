"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleCheck, CornerUpLeft, ExternalLink, Plus } from "lucide-react";
import AdminPageHeader from "@/app/admin/AdminPageHeader";
import { AdminMenu, AdminSelect, ExpandRow } from "@/app/admin/AdminControls";
import { formatTimeAgo } from "@/lib/reader/timeAgo";

export type Channel = "push" | "email";

export type AdminBroadcastRow = {
  id: string;
  title: string;
  body: string;
  url: string;
  recipient_count: number;
  failure_count: number;
  channels: Channel[];
  email_recipient_count: number;
  email_failure_count: number;
  created_at: string;
};

type Filter = "all" | Channel;

const n = (count: number) => count.toLocaleString("en");
const plural = (count: number, word: string, many = `${word}s`) => `${n(count)} ${count === 1 ? word : many}`;
const TD = "px-3 py-2.5 align-middle";
const TH = "px-3 py-2.5 font-[inherit]";

export function deliverySummary(item: AdminBroadcastRow) {
  const parts: string[] = [];
  if (item.channels.includes("push")) {
    parts.push(
      item.recipient_count === 0
        ? "Push: no subscribed devices"
        : `Push: ${n(item.recipient_count - item.failure_count)} of ${plural(item.recipient_count, "device")}`
    );
  }
  if (item.channels.includes("email")) {
    parts.push(
      item.email_recipient_count === 0
        ? "Email: no opted-in members"
        : `Email: ${n(item.email_recipient_count - item.email_failure_count)} of ${plural(item.email_recipient_count, "inbox", "inboxes")}`
    );
  }
  return parts.join(" · ");
}

const via = (item: AdminBroadcastRow) =>
  item.channels.includes("push") && item.channels.includes("email") ? "App and email" : item.channels.includes("email") ? "Email" : "App";

/** /admin/push: what's been sent, newest first, each row opening to the
 * full message. New broadcasts are written on /admin/push/new. */
export default function BroadcastHistoryView({ broadcasts, sentId }: { broadcasts: AdminBroadcastRow[]; sentId: string | null }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const sent = sentId ? broadcasts.find((b) => b.id === sentId) : undefined;

  const visible = broadcasts.filter((b) => filter === "all" || b.channels.includes(filter));

  return (
    <div>
      <AdminPageHeader
        title="Broadcast"
        subtitle={broadcasts.length ? `Announcements sent to members · last ${broadcasts.length}` : "Announcements sent to members"}
        actions={
          <>
            <AdminSelect
              value={filter}
              onChange={setFilter}
              label="Filter by channel"
              options={[
                { value: "all", label: "All channels" },
                { value: "push", label: "App" },
                { value: "email", label: "Email" },
              ]}
            />
            <AdminMenu items={[{ label: "New broadcast", icon: <Plus size={14} />, onClick: () => router.push("/admin/push/new") }]} />
          </>
        }
      />

      {sent && (
        <p role="status" className="m-0 mb-4 flex items-center gap-1.5 rounded-sm border border-[var(--reader-border)] px-4 py-3 text-[13px] font-semibold text-[var(--reader-text)]">
          <CircleCheck size={15} className="flex-none text-emerald-500" aria-hidden />
          Sent “{sent.title}”. {deliverySummary(sent)}.
        </p>
      )}

      <div className="overflow-x-auto rounded-sm border border-[var(--reader-border)]">
        {visible.length === 0 ? (
          <p className="m-0 px-5 py-10 text-center text-sm text-[var(--reader-text-muted)]">
            {broadcasts.length === 0 ? "No broadcasts sent yet." : "No broadcasts on that channel."}
          </p>
        ) : (
          <table className="w-full min-w-[820px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--reader-border)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--reader-text-subtle)]">
                <th className="w-8" />
                <th className={TH}>Title</th>
                <th className={TH}>Message</th>
                <th className={TH}>Sent via</th>
                <th className={TH}>Delivered</th>
                <th className={TH}>Sent</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <ExpandRow
                  key={item.id}
                  open={openId === item.id}
                  onToggle={() => setOpenId((current) => (current === item.id ? null : item.id))}
                  columns={6}
                  cells={
                    <>
                      <td className={`${TD} max-w-[240px] truncate font-semibold text-[var(--reader-text)]`}>{item.title}</td>
                      <td className={`${TD} max-w-[320px] truncate text-[var(--reader-text-muted)]`}>{item.body}</td>
                      <td className={`${TD} whitespace-nowrap text-[var(--reader-text-muted)]`}>{via(item)}</td>
                      <td className={`${TD} max-w-[220px] truncate text-[var(--reader-text-muted)]`}>{deliverySummary(item)}</td>
                      <td className={`${TD} whitespace-nowrap text-[var(--reader-text-muted)]`} title={new Date(item.created_at).toLocaleString("en")}>
                        {formatTimeAgo(new Date(item.created_at).getTime())}
                      </td>
                    </>
                  }
                >
                  <div className="flex flex-col gap-3">
                    <p className="m-0 text-[14px] font-semibold text-[var(--reader-text)]">{item.title}</p>
                    <p className="m-0 max-w-prose whitespace-pre-line text-[13px] leading-relaxed text-[var(--reader-text-muted)]">{item.body}</p>
                    <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[12px]">
                      <dt className="font-semibold text-[var(--reader-text-subtle)]">Delivered</dt>
                      <dd className="m-0 text-[var(--reader-text)]">{deliverySummary(item)}</dd>
                      <dt className="font-semibold text-[var(--reader-text-subtle)]">Opens</dt>
                      <dd className="m-0 min-w-0">
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 break-all text-[var(--reader-text)] hover:underline">
                            {item.url}
                            <ExternalLink size={12} className="flex-none" aria-hidden />
                          </a>
                        ) : (
                          <span className="text-[var(--reader-text)]">Nothing, just the message</span>
                        )}
                      </dd>
                      <dt className="font-semibold text-[var(--reader-text-subtle)]">Sent</dt>
                      <dd className="m-0 text-[var(--reader-text)]">{new Date(item.created_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</dd>
                    </dl>
                    <div className="flex justify-end">
                      <Link
                        href={`/admin/push/new?reuse=${item.id}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-sand-300 px-3 text-[13px] font-semibold text-[var(--reader-text)] no-underline transition-colors hover:bg-[var(--reader-surface-hover)]"
                      >
                        <CornerUpLeft size={14} aria-hidden />
                        Reuse
                      </Link>
                    </div>
                  </div>
                </ExpandRow>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

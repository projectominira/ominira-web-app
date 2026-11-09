"use client";

import Link from "next/link";
import AdminPageHeader from "@/app/admin/AdminPageHeader";
import { formatTimeAgo } from "@/lib/reader/timeAgo";

export type AdminRoomRow = {
  id: string;
  title: string;
  book: string;
  group: { name: string; slug: string } | null;
  startedBy: string | null;
  live: boolean;
  startedAt: string;
  endedAt: string | null;
  readers: number;
};


function duration(from: string, to: string): string {
  const minutes = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export default function RoomsAdminView({ rooms, limit }: { rooms: AdminRoomRow[]; limit: number }) {
  const liveCount = rooms.filter((r) => r.live).length;

  return (
    <div>
      <AdminPageHeader
        title="Reading rooms"
        subtitle={`${rooms.length >= limit ? `Latest ${limit.toLocaleString("en")}` : `${rooms.length.toLocaleString("en")}`} ${rooms.length === 1 ? "room" : "rooms"} · ${liveCount} live now`}
      />

      <div className="overflow-x-auto rounded-sm border border-[var(--reader-border)]">
        {rooms.length === 0 ? (
          <p className="m-0 px-5 py-10 text-center text-sm text-[var(--reader-text-muted)]">
            No reading rooms yet.
          </p>
        ) : (
          <table className="w-full min-w-[860px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--reader-border)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--reader-text-subtle)]">
                <th className="px-3 py-2.5 font-[inherit]">Room</th>
                <th className="px-3 py-2.5 font-[inherit]">Group</th>
                <th className="px-3 py-2.5 font-[inherit]">Host</th>
                <th className="px-3 py-2.5 text-right font-[inherit]">Readers</th>
                <th className="px-3 py-2.5 font-[inherit]">Started</th>
                <th className="px-3 py-2.5 font-[inherit]">Length</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id} className="border-b border-[var(--reader-border)] last:border-b-0 hover:bg-[var(--reader-surface-hover)]">
                  <td className="max-w-[320px] px-3 py-2.5 align-middle">
                    <span className="block truncate font-semibold text-[var(--reader-text)]">{r.title}</span>
                    {r.title !== `${r.book} reading room` && <span className="block truncate text-[var(--reader-text-subtle)]">{r.book}</span>}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2.5 align-middle text-[var(--reader-text-muted)]">
                    {r.group ? (
                      <Link href={`/groups/${r.group.slug}`} target="_blank" rel="noopener noreferrer" className="text-[var(--reader-text-muted)] hover:underline">
                        {r.group.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2.5 align-middle text-[var(--reader-text-muted)]">{r.startedBy ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right align-middle tabular-nums text-[var(--reader-text-muted)]">{r.readers}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle text-[var(--reader-text-muted)]">{formatTimeAgo(new Date(r.startedAt).getTime())}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                    {r.live ? (
                      <Link href={`/room/${r.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-brand-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                        Live now
                      </Link>
                    ) : (
                      <span className="text-[var(--reader-text-muted)]">{r.endedAt ? duration(r.startedAt, r.endedAt) : "—"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

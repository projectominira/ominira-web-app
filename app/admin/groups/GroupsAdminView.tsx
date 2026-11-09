"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import AdminPageHeader from "@/app/admin/AdminPageHeader";
import { formatTimeAgo } from "@/lib/reader/timeAgo";

export type AdminGroupRow = {
  id: string;
  slug: string;
  name: string;
  isPrivate: boolean;
  members: number;
  reading: string | null;
  createdBy: string | null;
  createdAt: string;
};


export default function GroupsAdminView({ groups }: { groups: AdminGroupRow[] }) {
  const memberTotal = groups.reduce((sum, g) => sum + g.members, 0);

  return (
    <div>
      <AdminPageHeader
        title="Study groups"
        subtitle={`${groups.length.toLocaleString("en")} ${groups.length === 1 ? "group" : "groups"} · ${memberTotal.toLocaleString("en")} ${memberTotal === 1 ? "membership" : "memberships"}`}
      />

      <div className="overflow-x-auto rounded-sm border border-[var(--reader-border)]">
        {groups.length === 0 ? (
          <p className="m-0 px-5 py-10 text-center text-sm text-[var(--reader-text-muted)]">
            No study groups yet.
          </p>
        ) : (
          <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--reader-border)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--reader-text-subtle)]">
                <th className="px-3 py-2.5 font-[inherit]">Group</th>
                <th className="px-3 py-2.5 font-[inherit]">Reading now</th>
                <th className="px-3 py-2.5 text-right font-[inherit]">Members</th>
                <th className="px-3 py-2.5 font-[inherit]">Created by</th>
                <th className="px-3 py-2.5 font-[inherit]">Created</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="border-b border-[var(--reader-border)] last:border-b-0 hover:bg-[var(--reader-surface-hover)]">
                  <td className="max-w-[260px] px-3 py-2.5 align-middle">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Link href={`/groups/${g.slug}`} target="_blank" rel="noopener noreferrer" className="truncate font-semibold text-[var(--reader-text)] hover:underline">
                        {g.name}
                      </Link>
                      {g.isPrivate && (
                        <span className="inline-flex flex-none items-center gap-0.5 text-[11px] font-semibold text-[var(--reader-text-subtle)]">
                          <Lock size={11} />
                          Invite only
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="max-w-[260px] truncate px-3 py-2.5 align-middle text-[var(--reader-text-muted)]">{g.reading ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right align-middle tabular-nums text-[var(--reader-text-muted)]">{g.members}</td>
                  <td className="max-w-[180px] truncate px-3 py-2.5 align-middle text-[var(--reader-text-muted)]">{g.createdBy ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle text-[var(--reader-text-muted)]">{formatTimeAgo(new Date(g.createdAt).getTime())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

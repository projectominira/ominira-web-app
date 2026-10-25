import "server-only";

import { after } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { notifyReaders } from "@/lib/notifications/notify";
import { positionPercent } from "@/lib/reader/locator";
import { localDay } from "@/lib/time/zone";
import { groupHref, targetTitle } from "@/lib/groups/copy";
import { isModerator, type Group, type GroupOutcome } from "@/lib/groups/membership";
import { groupMean, onTrackCount, progressWord } from "@/lib/groups/progress";
import { targetsReached } from "@/lib/groups/milestones";
import type { GroupTarget, TargetView } from "@/lib/groups/types";
import type { Database } from "@/lib/supabase/database.types";

// This week's target (studygroup-spec.md §4.2) for the thin
// app/api/groups/{slug}/target route and the cron reminder. One active
// target per group and where a new one starts are SQL's
// (set_group_target / group_target_start, migrations/20261025_group_targets.sql);
// the maths is lib/groups/progress.ts.

type TargetRow = Database["public"]["Tables"]["group_targets"]["Row"];

export function toTarget(row: TargetRow): GroupTarget {
  return {
    id: row.id,
    materialId: row.material_id,
    // numeric comes back as a number or a string, depending on the path.
    startPct: Number(row.start_pct),
    endPct: Number(row.end_pct),
    endLabel: row.end_label,
    endChapter: row.end_chapter,
    chapterCount: row.chapter_count,
    startsOn: row.starts_on,
    dueOn: row.due_on,
  };
}

async function runningRow(groupId: string, currentMaterialId: string | null, today: string): Promise<TargetRow | null> {
  if (!currentMaterialId) return null;
  const { data, error } = await getSupabaseAdminClient()
    .from("group_targets")
    .select("*")
    .eq("group_id", groupId)
    .is("superseded_at", null)
    .eq("material_id", currentMaterialId)
    .gte("due_on", today)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** The running target: active, on the current book, and not past due. */
export async function runningTarget(groupId: string, currentMaterialId: string | null, today: string): Promise<GroupTarget | null> {
  const row = await runningRow(groupId, currentMaterialId, today);
  return row ? toTarget(row) : null;
}

async function pseudonymOf(readerId: string | null): Promise<string | null> {
  if (!readerId) return null;
  const { data, error } = await getSupabaseAdminClient().from("readers").select("pseudonym").eq("id", readerId).maybeSingle();
  if (error) throw error;
  return data?.pseudonym ?? null;
}

/** The group's current book, if any. */
export async function currentBook(groupId: string): Promise<string | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from("group_books")
    .select("material_id")
    .eq("group_id", groupId)
    .eq("status", "current")
    .maybeSingle();
  if (error) throw error;
  return data?.material_id ?? null;
}

/** Each reader's progress on a book, null if they haven't started it. A book
 * marked finished counts as 100 (positionPercent). */
export async function progressOn(materialId: string, readerIds: string[]): Promise<Map<string, number>> {
  if (readerIds.length === 0) return new Map();
  const { data, error } = await getSupabaseAdminClient()
    .from("reader_activities")
    .select("reader_id, progress_percent, finished_at")
    .eq("material_id", materialId)
    .in("reader_id", readerIds);
  if (error) throw error;
  return new Map(
    data.map((r) => [r.reader_id, positionPercent({ progressPercent: r.progress_percent, finishedAt: r.finished_at })])
  );
}

export async function getTargetView(group: Group, viewerId: string | null): Promise<TargetView> {
  const admin = getSupabaseAdminClient();
  const today = localDay(Date.now(), group.timezone);
  const [materialId, members] = await Promise.all([
    currentBook(group.id),
    admin.from("group_members").select("reader_id").eq("group_id", group.id),
  ]);
  if (members.error) throw members.error;
  const memberIds = members.data.map((m) => m.reader_id);

  const [row, start, progress, reached] = await Promise.all([
    runningRow(group.id, materialId, today),
    materialId ? admin.rpc("group_target_start", { grp: group.id, material: materialId, today }) : null,
    materialId ? progressOn(materialId, memberIds) : new Map<string, number>(),
    targetsReached(group.id),
  ]);
  if (start?.error) throw start.error;
  const target = row && toTarget(row);
  const setBy = await pseudonymOf(row?.created_by ?? null);

  const pcts = memberIds.map((id) => progress.get(id) ?? null);
  return {
    today,
    currentMaterialId: materialId,
    target,
    setBy,
    draftStartPct: Number(start?.data?.[0]?.from_pct ?? 0),
    memberCount: memberIds.length,
    onTrack: target ? onTrackCount(target, pcts, today) : 0,
    groupPct: groupMean(pcts),
    mine: viewerId && memberIds.includes(viewerId) ? { pct: progress.get(viewerId) ?? null } : null,
    words: target ? Object.fromEntries(memberIds.map((id, i) => [id, progressWord(target, pcts[i], today)])) : {},
    progress: Object.fromEntries(memberIds.map((id, i) => [id, pcts[i]])),
    reached,
  };
}

export type TargetInput = {
  endPct: number;
  endLabel: string;
  endChapter: number | null;
  chapterCount: number | null;
  dueOn: string;
  /** "Let members know" (`target_set`). */
  notify: boolean;
};

/** Sets this week's target on the current book (M7). Moderators only. */
export async function setTarget(group: Group, actorId: string, input: TargetInput): Promise<GroupOutcome> {
  if (!(await isModerator(group.id, actorId))) return "forbidden";
  const today = localDay(Date.now(), group.timezone);
  if (input.dueOn < today) return "due_in_past";
  const materialId = await currentBook(group.id);
  if (!materialId) return "no_current_book";

  const { data, error } = await getSupabaseAdminClient().rpc("set_group_target", {
    grp: group.id,
    material: materialId,
    new_end_pct: input.endPct,
    new_end_label: input.endLabel,
    new_end_chapter: input.endChapter,
    new_chapter_count: input.chapterCount,
    today,
    new_due_on: input.dueOn,
    reader: actorId,
  });
  if (error) throw error;
  if (data === "below_start") return "below_start";
  if (input.notify) notifyTargetSet(group, actorId, data, targetTitle(input, today));
  return "ok";
}

/** "No target this week" (5b): the running target ends now, and the next
 * one starts where it would have. Moderators only. */
export async function clearTarget(group: Group, actorId: string): Promise<GroupOutcome> {
  if (!(await isModerator(group.id, actorId))) return "forbidden";
  const { error } = await getSupabaseAdminClient()
    .from("group_targets")
    .update({ superseded_at: new Date().toISOString() })
    .eq("group_id", group.id)
    .is("superseded_at", null);
  if (error) throw error;
  return "ok";
}

/** `target_set` to every member but the moderator, after the response. */
function notifyTargetSet(group: Group, actorId: string, targetId: string, title: string) {
  after(async () => {
    try {
      const { data: members } = await getSupabaseAdminClient()
        .from("group_members")
        .select("reader_id")
        .eq("group_id", group.id)
        .neq("reader_id", actorId);
      if (!members?.length) return;
      await notifyReaders(
        members.map((m) => m.reader_id),
        {
          kind: "target_set",
          groupId: group.id,
          title: `This week: ${title}`,
          body: group.name,
          url: `${groupHref(group.slug)}?tab=schedule`,
          tag: `group-target-${group.id}`,
          actorReaderId: actorId,
          ref: targetId,
        }
      );
    } catch (err) {
      console.error("Failed to send target_set", err);
    }
  });
}


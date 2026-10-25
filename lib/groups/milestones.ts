import "server-only";

import { after } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { notifyReaders, type NotifyTally } from "@/lib/notifications/notify";
import { addDays, localDay } from "@/lib/time/zone";
import { comradeCount, groupHref } from "@/lib/groups/copy";
import { formatDay } from "@/lib/time/format";
import { SESSION_LENGTH } from "@/lib/groups/sessions";
import { progressOn, toTarget } from "@/lib/groups/targets";
import type { Group } from "@/lib/groups/membership";
import type { GroupMilestone } from "@/lib/groups/types";
import type { Database } from "@/lib/supabase/database.types";

// Group milestones (studygroup-spec.md §4.3): a book finished, a session
// held, a target the circle reached. Each is posted once (unique ref) as a
// system item in the group feed and counted in Together so far; books and
// targets also send `milestone` to members.

type MilestoneInsert = Database["public"]["Tables"]["group_milestones"]["Insert"];
type MilestoneRow = Database["public"]["Tables"]["group_milestones"]["Row"];
type GroupRef = Pick<Group, "id" | "name" | "slug">;

const DAY = 86_400_000;

export const toMilestone = (row: MilestoneRow): GroupMilestone => ({
  id: row.id,
  kind: row.kind,
  materialId: row.material_id,
  title: row.title,
  detail: row.detail,
  reached: row.reached,
  total: row.total,
  createdAt: row.created_at,
});

/** "19 of 24 comrades". */
const ofMembers = (reached: number, total: number) => `${reached} of ${comradeCount(total)}`;

/** Posts it unless it's already there; true when this call posted it. */
async function post(row: MilestoneInsert): Promise<boolean> {
  const { data, error } = await getSupabaseAdminClient()
    .from("group_milestones")
    .upsert(row, { onConflict: "group_id,kind,ref", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return data.length > 0;
}

async function memberIds(groupId: string): Promise<string[]> {
  const { data, error } = await getSupabaseAdminClient().from("group_members").select("reader_id").eq("group_id", groupId);
  if (error) throw error;
  return data.map((m) => m.reader_id);
}

/** `milestone` to the members (but whoever caused it), deduped per thing. */
async function tellMembers(group: GroupRef, ids: string[], title: string, ref: string) {
  return notifyReaders(ids, {
    kind: "milestone",
    title: title.replace(/\.$/, ""),
    body: group.name,
    url: groupHref(group.slug),
    tag: `group-milestone-${group.id}`,
    ref,
  });
}

/** Mark as done: "The circle finished {title}.", with how many members did,
 * after the response. */
export function postBookFinished(group: GroupRef, actorId: string, materialId: string): void {
  after(async () => {
    try {
      const admin = getSupabaseAdminClient();
      const [{ data: material }, members] = await Promise.all([
        admin.from("materials").select("title").eq("id", materialId).single(),
        memberIds(group.id),
      ]);
      if (!material) return;
      const title = `The circle finished ${material.title}.`;
      const posted = await post({
        group_id: group.id,
        kind: "book_finished",
        ref: materialId,
        material_id: materialId,
        title,
        detail: null,
        reached: 0,
        total: members.length,
      });
      if (posted) await tellMembers(group, members.filter((id) => id !== actorId), title, `book:${group.id}:${materialId}`);
    } catch (err) {
      console.error("Failed to post a book milestone", err);
    }
  });
}

/** From the cron: sessions held (once their slot is over, if anyone came)
 * and targets past their day that most of the circle reached. */
export async function sendGroupMilestones(now = Date.now()): Promise<NotifyTally> {
  const [, tally] = await Promise.all([postSessionsHeld(now), postTargetsReached(now)]);
  return tally;
}

/** "Session 4 held.": feed only; members already had session_soon. */
async function postSessionsHeld(now: number): Promise<void> {
  const admin = getSupabaseAdminClient();
  // Looks back two days, so a missed run catches up.
  const { data: sessions, error } = await admin
    .from("group_sessions")
    .select("id, group_id, number, topic, material_id")
    .is("cancelled_at", null)
    .lte("starts_at", new Date(now - SESSION_LENGTH).toISOString())
    .gt("starts_at", new Date(now - SESSION_LENGTH - 2 * DAY).toISOString());
  if (error) throw error;
  if (sessions.length === 0) return;

  const ids = sessions.map((s) => s.id);
  const groupIds = [...new Set(sessions.map((s) => s.group_id))];
  const [posted, came, members] = await Promise.all([
    admin.from("group_milestones").select("ref").eq("kind", "session_held").in("ref", ids),
    admin.from("session_attendance").select("session_id").in("session_id", ids),
    admin.from("group_members").select("group_id").in("group_id", groupIds),
  ]);
  if (posted.error) throw posted.error;
  if (came.error) throw came.error;
  if (members.error) throw members.error;

  const done = new Set(posted.data.map((m) => m.ref));
  for (const s of sessions) {
    const reached = came.data.filter((a) => a.session_id === s.id).length;
    if (done.has(s.id) || reached === 0) continue;
    const total = members.data.filter((m) => m.group_id === s.group_id).length;
    await post({
      group_id: s.group_id,
      kind: "session_held",
      ref: s.id,
      material_id: s.material_id,
      title: `Session ${s.number} held.`,
      detail: `${s.topic} · ${ofMembers(reached, total)} came.`,
      reached,
      total,
    });
  }
}

/** "The circle finished Ch. 3 together.", once the target's day is over in
 * the group's timezone, when at least half the members got there. */
async function postTargetsReached(now: number): Promise<NotifyTally> {
  const tally: NotifyTally = { readers: 0, pushed: 0, emailed: 0 };
  const admin = getSupabaseAdminClient();
  const utcToday = localDay(now, "UTC");
  const { data: rows, error } = await admin
    .from("group_targets")
    .select("*")
    .gte("due_on", addDays(utcToday, -3))
    .lte("due_on", utcToday);
  if (error) throw error;
  if (rows.length === 0) return tally;

  const [groups, posted] = await Promise.all([
    admin.from("groups").select("id, slug, name, timezone").in("id", [...new Set(rows.map((r) => r.group_id))]),
    admin.from("group_milestones").select("ref").eq("kind", "target_reached").in("ref", rows.map((r) => r.id)),
  ]);
  if (groups.error) throw groups.error;
  if (posted.error) throw posted.error;
  const done = new Set(posted.data.map((m) => m.ref));

  for (const row of rows) {
    const group = groups.data.find((g) => g.id === row.group_id);
    if (!group || done.has(row.id)) continue;
    const target = toTarget(row);
    if (localDay(now, group.timezone) <= target.dueOn) continue;
    // Replaced before its day was out: an edit, not a finished target.
    if (row.superseded_at && localDay(Date.parse(row.superseded_at), group.timezone) <= target.dueOn) continue;

    const members = await memberIds(group.id);
    const progress = await progressOn(target.materialId, members);
    const reached = members.filter((id) => (progress.get(id) ?? 0) >= target.endPct).length;
    if (reached === 0 || reached * 2 < members.length) continue;

    const title =
      target.endChapter !== null ? `The circle finished ${target.endLabel} together.` : `The circle reached ${target.endLabel} together.`;
    const isNew = await post({
      group_id: group.id,
      kind: "target_reached",
      ref: target.id,
      material_id: target.materialId,
      title,
      detail: `${ofMembers(reached, members.length)} read it by ${formatDay(target.dueOn, "weekday")}.`,
      reached,
      total: members.length,
    });
    if (!isNew) continue;
    const sent = await tellMembers(group, members, title, `target:${target.id}`);
    tally.readers += sent.readers;
    tally.pushed += sent.pushed;
    tally.emailed += sent.emailed;
  }
  return tally;
}

/** Together so far: targets the circle reached, and the latest. */
export async function targetsReached(groupId: string): Promise<{ count: number; latest: string | null }> {
  const { data, error, count } = await getSupabaseAdminClient()
    .from("group_milestones")
    .select("title", { count: "exact" })
    .eq("group_id", groupId)
    .eq("kind", "target_reached")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return { count: count ?? 0, latest: data[0]?.title ?? null };
}

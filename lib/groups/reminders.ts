import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { notifyReaders, type NotifyTally } from "@/lib/notifications/notify";
import { localDay, localMinutes } from "@/lib/time/zone";
import { groupHref, pct, targetTitle } from "@/lib/groups/copy";
import { personalCheckpoint, planCheckpoint } from "@/lib/groups/progress";
import { progressOn, toTarget } from "@/lib/groups/targets";

// Who is due a scheduled reminder (studygroup-spec.md §9.3). The cron route
// asks these and lib/notifications delivers; dedupe there makes overlapping
// runs and retries harmless.

/** 08:00 in the reader's own timezone, with an hour's grace in case a run
 * is missed. */
const MORNING = 8 * 60;
const GRACE = 60;

const empty = (): NotifyTally => ({ readers: 0, pushed: 0, emailed: 0 });

/**
 * `target_reminder` (§7): at 08:00 local, each member of a group with a
 * running target who hasn't yet reached today's checkpoint on the group plan,
 * told where they need to get to today ("Today: to 41% for …"). One per
 * target, reader and group day.
 */
export async function sendTargetReminders(now = Date.now()): Promise<NotifyTally> {
  const admin = getSupabaseAdminClient();
  const { data: rows, error } = await admin.from("group_targets").select("*").is("superseded_at", null);
  if (error) throw error;
  if (rows.length === 0) return empty();

  const groupIds = rows.map((r) => r.group_id);
  const [groups, current, members] = await Promise.all([
    admin.from("groups").select("id, slug, name, timezone").in("id", groupIds),
    admin.from("group_books").select("group_id, material_id").eq("status", "current").in("group_id", groupIds),
    admin.from("group_members").select("group_id, reader_id").in("group_id", groupIds),
  ]);
  if (groups.error) throw groups.error;
  if (current.error) throw current.error;
  if (members.error) throw members.error;

  const readerIds = [...new Set(members.data.map((m) => m.reader_id))];
  const { data: readers, error: readersError } = readerIds.length
    ? await admin.from("readers").select("id, timezone").in("id", readerIds)
    : { data: [], error: null };
  if (readersError) throw readersError;
  const zoneOf = new Map(readers.map((r) => [r.id, r.timezone]));

  const tally = empty();
  for (const row of rows) {
    const group = groups.data.find((g) => g.id === row.group_id);
    const target = toTarget(row);
    if (!group || !current.data.some((c) => c.group_id === group.id && c.material_id === target.materialId)) continue;
    const today = localDay(now, group.timezone);
    if (today < target.startsOn || today > target.dueOn) continue;

    // Members whose morning it is now.
    const due = members.data
      .filter((m) => m.group_id === group.id)
      .map((m) => m.reader_id)
      .filter((id) => {
        const minutes = localMinutes(now, zoneOf.get(id) ?? group.timezone);
        return minutes >= MORNING && minutes < MORNING + GRACE;
      });
    if (due.length === 0) continue;

    const progress = await progressOn(target.materialId, due);
    const planned = planCheckpoint(target, today);
    // One send per checkpoint: the line is each reader's own.
    const byCheckpoint = new Map<number, string[]>();
    for (const id of due) {
      const mine = progress.get(id) ?? 0;
      const checkpoint = personalCheckpoint(target, mine, today);
      if (checkpoint === null || mine >= planned) continue;
      byCheckpoint.set(checkpoint, [...(byCheckpoint.get(checkpoint) ?? []), id]);
    }

    for (const [checkpoint, ids] of byCheckpoint) {
      const sent = await notifyReaders(ids, {
        kind: "target_reminder",
        groupId: group.id,
        title: `Today: to ${pct(checkpoint)} for ${group.name}`,
        body: targetTitle(target, today),
        url: `${groupHref(group.slug)}?tab=schedule`,
        tag: `group-target-${group.id}`,
        ref: `${target.id}:${today}`,
      });
      tally.readers += sent.readers;
      tally.pushed += sent.pushed;
      tally.emailed += sent.emailed;
    }
  }
  return tally;
}

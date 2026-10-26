import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { notifyReaders, type NotifyTally } from "@/lib/notifications/notify";
import { addDays, localDay, localMinutes } from "@/lib/time/zone";
import { atRisk } from "@/lib/streaks/rules";

/** 19:00 in the reader's own timezone, with an hour's grace in case a run
 * is missed (as target_reminder's 08:00, lib/groups/reminders.ts). */
const EVENING = 19 * 60;
const GRACE = 60;

/**
 * `streak_risk` (§7): at 19:00 local, each reader with a live streak who
 * hasn't met today's goal. One per reader and day. There's no midnight job: a
 * missed day ends the streak by being read against today (rules.ts).
 */
export async function sendStreakRisk(now = Date.now()): Promise<NotifyTally> {
  const admin = getSupabaseAdminClient();
  // Alive for someone somewhere: last read no earlier than two UTC days ago.
  const { data: streaks, error } = await admin
    .from("reader_streaks")
    .select("reader_id, current, best, last_day, previous, restore_month, declined_on")
    .gt("current", 0)
    .gte("last_day", addDays(localDay(now, "UTC"), -2));
  if (error) throw error;
  const tally: NotifyTally = { readers: 0, pushed: 0, emailed: 0 };
  if (streaks.length === 0) return tally;

  const { data: readers, error: readersError } = await admin
    .from("readers")
    .select("id, timezone")
    .in(
      "id",
      streaks.map((s) => s.reader_id)
    );
  if (readersError) throw readersError;
  const zoneOf = new Map(readers.map((r) => [r.id, r.timezone ?? "UTC"]));

  // One send per count: the line is each reader's own.
  const byDays = new Map<number, string[]>();
  for (const s of streaks) {
    const tz = zoneOf.get(s.reader_id) ?? "UTC";
    const minutes = localMinutes(now, tz);
    if (minutes < EVENING || minutes >= EVENING + GRACE) continue;
    const streak = { current: s.current, best: s.best, lastDay: s.last_day, previous: s.previous, restoreMonth: s.restore_month, declinedOn: s.declined_on };
    if (!atRisk(streak, localDay(now, tz))) continue;
    byDays.set(s.current, [...(byDays.get(s.current) ?? []), s.reader_id]);
  }

  for (const [days, ids] of byDays) {
    const sent = await notifyReaders(ids, {
      kind: "streak_risk",
      title: `Meet today's goal before midnight to keep your ${days} ${days === 1 ? "day" : "days"}`,
      body: "Read or listen to reach today's goal.",
      url: "/home",
      tag: "streak-risk",
      ref: "streak",
    });
    tally.readers += sent.readers;
    tally.pushed += sent.pushed;
    tally.emailed += sent.emailed;
  }
  return tally;
}

import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { notifyReaders, type NotifyPayload, type NotifyTally } from "@/lib/notifications/notify";
import { addDays, localDay, localMinutes } from "@/lib/time/zone";
import { atRisk } from "@/lib/streaks/rules";
import { dailyGoal, toMinutes } from "@/lib/rooms/home";

/** 19:00 in the reader's own timezone, with an hour's grace in case a run
 * is missed (as target_reminder's 08:00, lib/groups/reminders.ts). */
const EVENING = 19 * 60;
const GRACE = 60;

/**
 * The 19:00 local nudges, one per reader and day:
 * - `streak_risk` (§7): a live streak whose goal isn't met today.
 * - `goal_reminder`: no streak at stake, but today's reading has started and
 *   the goal isn't met yet.
 * There's no midnight job: a missed day ends the streak by being read against
 * today (rules.ts).
 */
export async function sendStreakRisk(now = Date.now()): Promise<NotifyTally> {
  const admin = getSupabaseAdminClient();
  const utcToday = localDay(now, "UTC");
  // Alive for someone somewhere: last read no earlier than two UTC days ago.
  // Today's reading: every zone's today is within a day of UTC's.
  const [streaksRes, timesRes] = await Promise.all([
    admin
      .from("reader_streaks")
      .select("reader_id, current, best, last_day, previous, restore_month, declined_on")
      .gt("current", 0)
      .gte("last_day", addDays(utcToday, -2)),
    admin
      .from("reader_reading_time")
      .select("reader_id, day, seconds, goal_minutes")
      .gt("seconds", 0)
      .gte("day", addDays(utcToday, -1))
      .lte("day", addDays(utcToday, 1)),
  ]);
  if (streaksRes.error) throw streaksRes.error;
  if (timesRes.error) throw timesRes.error;
  const streaks = streaksRes.data;
  const times = timesRes.data;
  const tally: NotifyTally = { readers: 0, pushed: 0, emailed: 0 };
  if (streaks.length === 0 && times.length === 0) return tally;

  const { data: readers, error: readersError } = await admin
    .from("readers")
    .select("id, timezone")
    .in("id", [...new Set([...streaks.map((s) => s.reader_id), ...times.map((t) => t.reader_id)])]);
  if (readersError) throw readersError;
  const zoneOf = new Map(readers.map((r) => [r.id, r.timezone ?? "UTC"]));
  const evening = (readerId: string) => {
    const minutes = localMinutes(now, zoneOf.get(readerId) ?? "UTC");
    return minutes >= EVENING && minutes < EVENING + GRACE;
  };

  // One send per line: each is the reader's own.
  const sends = new Map<string, { payload: NotifyPayload; ids: string[] }>();
  const add = (key: string, payload: NotifyPayload, id: string) => {
    const send = sends.get(key) ?? { payload, ids: [] };
    send.ids.push(id);
    sends.set(key, send);
  };

  // A live streak gets the streak line, whether or not today has started.
  const streaked = new Set<string>();
  for (const s of streaks) {
    const tz = zoneOf.get(s.reader_id) ?? "UTC";
    const streak = { current: s.current, best: s.best, lastDay: s.last_day, previous: s.previous, restoreMonth: s.restore_month, declinedOn: s.declined_on };
    if (!atRisk(streak, localDay(now, tz))) continue;
    streaked.add(s.reader_id);
    if (!evening(s.reader_id)) continue;
    const days = s.current;
    add(`streak-${days}`, {
      kind: "streak_risk",
      title: `Meet today's reading goal before midnight to keep your ${days}-day streak`,
      body: "Read or listen to reach today's goal.",
      url: "/home",
      tag: "streak-risk",
      ref: "streak",
    }, s.reader_id);
  }

  for (const t of times) {
    if (streaked.has(t.reader_id) || !evening(t.reader_id)) continue;
    if (t.day !== localDay(now, zoneOf.get(t.reader_id) ?? "UTC")) continue;
    const goal = dailyGoal(t.goal_minutes);
    if (t.seconds >= goal * 60) continue;
    const read = toMinutes(t.seconds);
    add(`goal-${read}-${goal}`, {
      kind: "goal_reminder",
      title: "Finish today's reading goal before midnight",
      body: `You've read ${read} of ${goal} minutes today.`,
      url: "/home",
      tag: "goal-reminder",
      ref: "goal",
    }, t.reader_id);
  }

  for (const { payload, ids } of sends.values()) {
    const sent = await notifyReaders(ids, payload);
    tally.readers += sent.readers;
    tally.pushed += sent.pushed;
    tally.emailed += sent.emailed;
  }
  return tally;
}

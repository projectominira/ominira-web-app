import "server-only";

import { after } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { addDays, localDay, type LocalDay } from "@/lib/time/zone";
import { advance, EMPTY_STREAK, restore, startFresh, streakState, type Streak } from "@/lib/streaks/rules";
import type { ReadingHistory, StreakView } from "@/lib/streaks/types";
import { dailyGoal, toMinutes } from "@/lib/rooms/home";
import type { StreakToday } from "@/lib/rooms/types";
import type { Database } from "@/lib/supabase/database.types";

// Streak I/O (studygroup-spec.md §4.4) around the pure rules in rules.ts:
// the recorder behind recordReadingDay, the reader's view, and Restore /
// Start fresh for the thin app/api/auth/me/streak route. Also today's
// reading time against the daily goal (rooms-spec §5.7), credited from the
// same saves by record_reading_time (migrations/20261107_reading_time.sql,
// per book since migrations/20261111_reading_history.sql).

/** A gap between saves up to this long is reading; longer is a new sitting. */
const IDLE_SECONDS = 300;
/** Each instance sends a reader's time at most this often. Gaps are measured
 * between the saves sent, so throttling loses at most the last few seconds
 * of a sitting. */
const TIME_EVERY_MS = 30_000;

type StreakRow = Database["public"]["Tables"]["reader_streaks"]["Row"];

const toStreak = (row: StreakRow | null): Streak =>
  row
    ? {
        current: row.current,
        best: row.best,
        lastDay: row.last_day,
        previous: row.previous,
        restoreMonth: row.restore_month,
        declinedOn: row.declined_on,
      }
    : EMPTY_STREAK;

/** The reader's zone, UTC until the device has synced one. */
async function readerZone(readerId: string): Promise<string> {
  const { data, error } = await getSupabaseAdminClient().from("readers").select("timezone").eq("id", readerId).maybeSingle();
  if (error) throw error;
  return data?.timezone ?? "UTC";
}

async function loadStreak(readerId: string): Promise<Streak> {
  const { data, error } = await getSupabaseAdminClient().from("reader_streaks").select("*").eq("reader_id", readerId).maybeSingle();
  if (error) throw error;
  return toStreak(data);
}

async function saveStreak(readerId: string, s: Streak): Promise<void> {
  const { error } = await getSupabaseAdminClient().from("reader_streaks").upsert({
    reader_id: readerId,
    current: s.current,
    best: s.best,
    last_day: s.lastDay,
    previous: s.previous,
    restore_month: s.restoreMonth,
    declined_on: s.declinedOn,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** A streak mark, kept for the milestone card. */
async function reachMark(readerId: string, mark: number, day: LocalDay): Promise<void> {
  const { error } = await getSupabaseAdminClient()
    .from("reader_milestones")
    .upsert({ reader_id: readerId, kind: "streak", value: mark, reached_on: day }, { ignoreDuplicates: true });
  if (error) throw error;
}

/** Counts `day` once: the day row is the claim, so only the first write of
 * the day advances the streak. Called once the day's goal is met. */
async function recordDay(readerId: string, day: LocalDay): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("reader_reading_days")
    .upsert({ reader_id: readerId, day }, { onConflict: "reader_id,day", ignoreDuplicates: true })
    .select("day");
  if (error) throw error;
  if (!data.length) return;

  const { streak, mark } = advance(await loadStreak(readerId), day);
  try {
    await saveStreak(readerId, streak);
  } catch (err) {
    // Give the claim back so the next save retries the day.
    await admin.from("reader_reading_days").delete().eq("reader_id", readerId).eq("day", day);
    throw err;
  }
  if (mark) await reachMark(readerId, mark, day);
}

// Like recordActiveDay's Set (lib/metrics/activeDays.ts), but keyed on the
// reader's local day: each instance sends the time at most every
// TIME_EVERY_MS, and claims the day once per reader per local day, when a
// save finds its goal met. The day maps start over each UTC day, which also
// picks up a changed zone.
let utcDay = "";
const zones = new Map<string, string>();
const recorded = new Map<string, LocalDay>();
const timeSent = new Map<string, number>();

/**
 * Credits the time since the reader's last save to today's minutes (their
 * local day) and the saved book, and counts today toward their streak once
 * its goal is met. Called only by recordReadingDay, when a reading position
 * is saved (listening saves them too). Runs after the response.
 */
export function recordReadingActivity(readerId: string, materialId: string): void {
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  if (day !== utcDay) {
    utcDay = day;
    zones.clear();
    recorded.clear();
  }
  if (now - (timeSent.get(readerId) ?? 0) < TIME_EVERY_MS) return;
  timeSent.set(readerId, now);
  const zone = zones.get(readerId);

  after(async () => {
    let today: LocalDay | null = null;
    try {
      const tz = zone ?? (await readerZone(readerId));
      zones.set(readerId, tz);
      today = localDay(now, tz);
      const { data, error } = await getSupabaseAdminClient().rpc("record_reading_time", {
        reader: readerId,
        material: materialId,
        today,
        at: new Date(now).toISOString(),
        idle_seconds: IDLE_SECONDS,
      });
      if (error) throw error;
      if (recorded.get(readerId) === today || data.day_seconds < data.day_goal * 60) return;
      recorded.set(readerId, today);
      await recordDay(readerId, today);
    } catch (err) {
      if (today && recorded.get(readerId) === today) recorded.delete(readerId);
      console.error("Failed to record reading time or a streak day", err);
    }
  });
}

/** Today's minutes against the goal, and everyone's minutes today (the
 * streak card). `today` is the reader's local day (StreakView.today). */
export async function getStreakToday(readerId: string, today: LocalDay): Promise<StreakToday> {
  const admin = getSupabaseAdminClient();
  const [time, goal, collective] = await Promise.all([
    admin.from("reader_reading_time").select("seconds").eq("reader_id", readerId).eq("day", today).maybeSingle(),
    admin.from("reader_streaks").select("daily_goal_minutes").eq("reader_id", readerId).maybeSingle(),
    admin.rpc("collective_reading_seconds", { today }),
  ]);
  if (time.error) throw time.error;
  if (goal.error) throw goal.error;
  if (collective.error) throw collective.error;
  return {
    minutes: toMinutes(time.data?.seconds ?? 0),
    goal: dailyGoal(goal.data?.daily_goal_minutes ?? null),
    collectiveMinutes: toMinutes(Number(collective.data)),
  };
}

/** Adjust: the reader's daily goal (validated by the route, isGoal), today's
 * goal too. A goal lowered to what's been read today keeps the day. */
export async function setDailyGoal(readerId: string, minutes: number): Promise<void> {
  const admin = getSupabaseAdminClient();
  const [streak, today] = await Promise.all([
    admin.from("reader_streaks").upsert({ reader_id: readerId, daily_goal_minutes: minutes, updated_at: new Date().toISOString() }),
    readerZone(readerId).then((tz) => localDay(Date.now(), tz)),
  ]);
  if (streak.error) throw streak.error;
  const { data, error } = await admin
    .from("reader_reading_time")
    .update({ goal_minutes: minutes })
    .eq("reader_id", readerId)
    .eq("day", today)
    .select("seconds")
    .maybeSingle();
  if (error) throw error;
  if (data && data.seconds >= minutes * 60) await recordDay(readerId, today);
}

/** The reader's streak today (C1), the days read this past week (the home
 * card's strip), and a mark reached today for the milestone card. */
export async function getStreakView(readerId: string): Promise<StreakView> {
  const today = localDay(Date.now(), await readerZone(readerId));
  const admin = getSupabaseAdminClient();
  const [streak, marks, days] = await Promise.all([
    loadStreak(readerId),
    admin.from("reader_milestones").select("value").eq("reader_id", readerId).eq("kind", "streak").eq("reached_on", today),
    admin.from("reader_reading_days").select("day").eq("reader_id", readerId).gte("day", addDays(today, -6)).lte("day", today),
  ]);
  if (marks.error) throw marks.error;
  if (days.error) throw days.error;
  return {
    today,
    state: streakState(streak, today),
    best: streak.best,
    days: days.data.map((d) => d.day),
    milestone: marks.data.length ? Math.max(...marks.data.map((m) => m.value)) : null,
  };
}

/** `year` of the reader's reading, in their local days (/history): each
 * day's time and goal, and whether the streak kept it. */
export async function getReadingHistory(readerId: string, year: number): Promise<ReadingHistory> {
  const today = localDay(Date.now(), await readerZone(readerId));
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const admin = getSupabaseAdminClient();
  const [kept, time, firstKept, firstTime, goal] = await Promise.all([
    admin.from("reader_reading_days").select("day, restored").eq("reader_id", readerId).gte("day", from).lte("day", to),
    admin.from("reader_reading_time").select("day, seconds, goal_minutes").eq("reader_id", readerId).gte("day", from).lte("day", to),
    // Days read before time was kept are only streak days.
    admin.from("reader_reading_days").select("day").eq("reader_id", readerId).eq("restored", false).order("day").limit(1).maybeSingle(),
    admin.from("reader_reading_time").select("day").eq("reader_id", readerId).gt("seconds", 0).order("day").limit(1).maybeSingle(),
    admin.from("reader_streaks").select("daily_goal_minutes").eq("reader_id", readerId).maybeSingle(),
  ]);
  for (const r of [kept, time, firstKept, firstTime, goal]) if (r.error) throw r.error;

  const days = new Map<string, ReadingHistory["days"][number]>();
  for (const t of time.data ?? []) days.set(t.day, { day: t.day, seconds: t.seconds, goal: t.goal_minutes, streak: null });
  for (const d of kept.data ?? []) {
    days.set(d.day, { day: d.day, seconds: 0, goal: null, ...days.get(d.day), streak: d.restored ? "restored" : "met" });
  }
  const firsts = [firstKept.data?.day, firstTime.data?.day].filter((d): d is string => !!d).sort();

  return {
    year,
    today,
    goal: dailyGoal(goal.data?.daily_goal_minutes ?? null),
    days: [...days.values()].filter((d) => d.seconds > 0 || d.streak).sort((a, b) => a.day.localeCompare(b.day)),
    firstDay: firsts[0] ?? today,
  };
}

/** Restore streak or Start fresh. False when there's nothing to choose. */
export async function chooseStreak(readerId: string, choice: "restore" | "fresh"): Promise<boolean> {
  const today = localDay(Date.now(), await readerZone(readerId));
  const streak = await loadStreak(readerId);
  if (streakState(streak, today).kind !== "restore") return false;

  if (choice === "fresh") {
    await saveStreak(readerId, startFresh(streak, today));
    return true;
  }
  const out = restore(streak, today)!;
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("reader_reading_days")
    .upsert({ reader_id: readerId, day: out.day, restored: true }, { onConflict: "reader_id,day" });
  if (error) throw error;
  // The month's restore is claimed with the write, so a double tap can't
  // use it twice.
  const { data, error: saveError } = await admin
    .from("reader_streaks")
    .update({
      current: out.streak.current,
      best: out.streak.best,
      last_day: out.streak.lastDay,
      previous: out.streak.previous,
      restore_month: out.streak.restoreMonth,
      updated_at: new Date().toISOString(),
    })
    .eq("reader_id", readerId)
    .or(`restore_month.is.null,restore_month.neq.${out.streak.restoreMonth}`)
    .select("reader_id");
  if (saveError) throw saveError;
  if (!data.length) return false;
  const mark = out.mark;
  if (mark) after(() => reachMark(readerId, mark, today).catch((err) => console.error("Failed to send milestone", err)));
  return true;
}

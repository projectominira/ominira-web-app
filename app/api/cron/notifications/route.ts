import { NextResponse } from "next/server";
import { sendTargetReminders } from "@/lib/groups/reminders";
import { sendSessionReminders } from "@/lib/groups/schedule";
import { sendGroupMilestones } from "@/lib/groups/milestones";
import { sendStreakRisk } from "@/lib/streaks/reminders";
import { publishScheduledPassage } from "@/lib/passage/calendar";
import { pingIndexNow } from "@/lib/seo/indexNow";

// Called every 5 minutes by pg_cron through pg_net
// (migrations/20261026_notifications_cron_plain.sql). Open, with no secret:
// each selector only sends what's due now, and lib/notifications dedupes per
// reader and day, so an extra call sends nothing new. Thin by design: it asks
// the lib selectors who is due and hands them to lib/notifications, which
// owns delivery and dedupe. Each selector joins with its phase.
export async function POST() {
  const [sessionReminders, targetReminders, streakRisk, groupMilestones, passage, indexNow] = await Promise.all([
    sendSessionReminders(),
    sendTargetReminders(),
    sendStreakRisk(),
    sendGroupMilestones(),
    // The day's scheduled passage, from 07:00 Lagos (passage-spec §8.3).
    publishScheduledPassage(),
    // Pages changed in the last few minutes, to Bing & co (seo-spec T10).
    pingIndexNow().catch((err) => (console.error("[indexnow]", err), 0)),
  ]);
  return NextResponse.json({ ok: true, sessionReminders, targetReminders, streakRisk, groupMilestones, passage, indexNow });
}

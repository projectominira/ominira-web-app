import { NextResponse } from "next/server";
import { sendTargetReminders } from "@/lib/groups/reminders";
import { sendSessionReminders } from "@/lib/groups/schedule";
import { sendGroupMilestones } from "@/lib/groups/milestones";
import { sendStreakRisk } from "@/lib/streaks/reminders";

// Called every 5 minutes by pg_cron through pg_net
// (migrations/20261026_notifications_cron_plain.sql). Open, with no secret:
// each selector only sends what's due now, and lib/notifications dedupes per
// reader and day, so an extra call sends nothing new. Thin by design: it asks
// the lib selectors who is due and hands them to lib/notifications, which
// owns delivery and dedupe. Each selector joins with its phase.
export async function POST() {
  const [sessionReminders, targetReminders, streakRisk, groupMilestones] = await Promise.all([
    sendSessionReminders(),
    sendTargetReminders(),
    sendStreakRisk(),
    sendGroupMilestones(),
  ]);
  return NextResponse.json({ ok: true, sessionReminders, targetReminders, streakRisk, groupMilestones });
}

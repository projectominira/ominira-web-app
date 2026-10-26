import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api/errors";
import { sendTargetReminders } from "@/lib/groups/reminders";
import { sendSessionReminders } from "@/lib/groups/schedule";
import { sendGroupMilestones } from "@/lib/groups/milestones";
import { sendStreakRisk } from "@/lib/streaks/reminders";

// Called every 5 minutes by pg_cron through pg_net
// (migrations/20261020_notifications_cron.sql), with CRON_SECRET from Vault
// as a bearer token (studygroup-spec.md §9.3). Thin by design: it asks the
// lib selectors who is due and hands them to lib/notifications, which owns
// delivery and dedupe. Each selector joins with its phase.
export async function POST(request: Request) {
  if (!isCron(request)) return unauthorized();
  const [sessionReminders, targetReminders, streakRisk, groupMilestones] = await Promise.all([
    sendSessionReminders(),
    sendTargetReminders(),
    sendStreakRisk(),
    sendGroupMilestones(),
  ]);
  return NextResponse.json({ ok: true, sessionReminders, targetReminders, streakRisk, groupMilestones });
}

function isCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

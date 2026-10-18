import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { conflict, unauthorized, validationError } from "@/lib/api/errors";
import { chooseStreak, getStreakView, setDailyGoal } from "@/lib/streaks/record";
import { isGoal } from "@/lib/rooms/home";

/** `GET /api/auth/me/streak`: the reader's streak today (C1). */
export async function GET(request: Request) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  return NextResponse.json(await getStreakView(reader.readerId));
}

const Choice = z.object({ choice: z.enum(["restore", "fresh"]) });

/** `POST /api/auth/me/streak` `{choice}`: Restore streak or Start fresh,
 * the day after a single missed day. */
export async function POST(request: Request) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const parsed = Choice.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("Choose restore or fresh.", "choice");
  if (!(await chooseStreak(reader.readerId, parsed.data.choice))) return conflict("There's no streak to restore today.");
  return new Response(null, { status: 204 });
}

const Goal = z.object({ goal: z.number().refine(isGoal) });

/** `PATCH /api/auth/me/streak` `{goal}`: the daily goal in minutes, from the
 * streak card's Adjust (rooms-spec §5.7). */
export async function PATCH(request: Request) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const parsed = Goal.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("Pick a goal between 5 minutes and 3 hours.", "goal");
  await setDailyGoal(reader.readerId, parsed.data.goal);
  return new Response(null, { status: 204 });
}

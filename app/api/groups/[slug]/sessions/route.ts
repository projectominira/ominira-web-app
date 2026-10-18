import { NextResponse } from "next/server";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized, validationError } from "@/lib/api/errors";
import { findGroup, groupResponse } from "@/lib/groups/membership";
import { createSession, getSessionsView, SessionInput } from "@/lib/groups/schedule";

type Params = { params: Promise<{ slug: string }> };

/** `GET /api/groups/{slug}/sessions`: upcoming and past sessions (the
 * session card, the Schedule's rows, M8). Public; `remind` needs a session. */
export async function GET(request: Request, { params }: Params) {
  const [group, reader] = await Promise.all([findGroup((await params).slug), getAuthenticatedReader(request)]);
  if (!group) return groupResponse("not_found");
  return NextResponse.json(await getSessionsView(group, reader?.readerId ?? null));
}

/** `POST /api/groups/{slug}/sessions`: schedule a session (M8). Moderators only. */
export async function POST(request: Request, { params }: Params) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const parsed = SessionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("Give the session a topic, a day and a time.", String(parsed.error.issues[0]?.path[0] ?? ""));

  const group = await findGroup((await params).slug);
  if (!group) return groupResponse("not_found");
  return groupResponse(await createSession(group, reader.readerId, parsed.data));
}

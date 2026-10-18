import { z } from "zod";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized, validationError } from "@/lib/api/errors";
import { UUID_RE } from "@/lib/materials/resolve";
import { findGroup, groupResponse } from "@/lib/groups/membership";
import { cancelSession, SessionInput, updateSession } from "@/lib/groups/schedule";

type Params = { params: Promise<{ slug: string; sessionId: string }> };

/** `PATCH /api/groups/{slug}/sessions/{id}`: edit a session (M8); on a
 * weekly one, the series from here on. Moderators only. */
export async function PATCH(request: Request, { params }: Params) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const { slug, sessionId } = await params;
  const parsed = SessionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("Give the session a topic, a day and a time.", String(parsed.error.issues[0]?.path[0] ?? ""));
  if (!UUID_RE.test(sessionId)) return groupResponse("session_not_found");

  const group = await findGroup(slug);
  if (!group) return groupResponse("not_found");
  return groupResponse(await updateSession(group, reader.readerId, sessionId, parsed.data));
}

const Scope = z.enum(["occurrence", "series"]);

/** `DELETE /api/groups/{slug}/sessions/{id}?scope=occurrence|series`: skip
 * this one, or end the weekly series. Moderators only. */
export async function DELETE(request: Request, { params }: Params) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const { slug, sessionId } = await params;
  const scope = Scope.safeParse(new URL(request.url).searchParams.get("scope") ?? "occurrence");
  if (!scope.success) return validationError("Unknown scope.", "scope");
  if (!UUID_RE.test(sessionId)) return groupResponse("session_not_found");

  const group = await findGroup(slug);
  if (!group) return groupResponse("not_found");
  return groupResponse(await cancelSession(group, reader.readerId, sessionId, scope.data));
}

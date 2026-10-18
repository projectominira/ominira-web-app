import { z } from "zod";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized, validationError } from "@/lib/api/errors";
import { UUID_RE } from "@/lib/materials/resolve";
import { findGroup, groupResponse } from "@/lib/groups/membership";
import { setReminder } from "@/lib/groups/schedule";

type Params = { params: Promise<{ slug: string; sessionId: string }> };

const Remind = z.object({ on: z.boolean() });

/** `PUT /api/groups/{slug}/sessions/{id}/remind`: Remind me, for the weekly
 * series or the single session. Members only. */
export async function PUT(request: Request, { params }: Params) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const { slug, sessionId } = await params;
  const parsed = Remind.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("Say on or off.", "on");
  if (!UUID_RE.test(sessionId)) return groupResponse("session_not_found");

  const group = await findGroup(slug);
  if (!group) return groupResponse("not_found");
  return groupResponse(await setReminder(group, reader.readerId, sessionId, parsed.data.on));
}

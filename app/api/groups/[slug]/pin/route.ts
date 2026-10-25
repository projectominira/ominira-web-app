import { z } from "zod";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized, validationError } from "@/lib/api/errors";
import { UUID_RE } from "@/lib/materials/resolve";
import { findGroup, groupResponse } from "@/lib/groups/membership";
import { pinInGroup } from "@/lib/groups/notes";

const Id = z.string().regex(UUID_RE).nullable();
const Pin = z
  .object({ postId: Id, target: z.boolean(), sessionId: Id })
  .partial()
  .refine((p) => Object.keys(p).length > 0);

/** `PUT /api/groups/{slug}/pin`: pin to the room's strip, or unpin — a
 * note (`postId`, one per group), this week's target (`target`), a session
 * (`sessionId`); null or false unpins, absent keys stay. Moderators only. */
export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const parsed = Pin.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("Say what to pin.");

  const group = await findGroup((await params).slug);
  if (!group) return groupResponse("not_found");
  return groupResponse(await pinInGroup(group, reader.readerId, parsed.data));
}

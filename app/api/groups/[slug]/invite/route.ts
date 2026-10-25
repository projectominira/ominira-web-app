import { z } from "zod";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized, validationError } from "@/lib/api/errors";
import { UUID_RE } from "@/lib/materials/resolve";
import { MAX_MENTIONS } from "@/lib/community/mentions";
import { findGroup, groupResponse } from "@/lib/groups/membership";
import { inviteToGroup } from "@/lib/groups/invites";

const Invite = z.object({ readerIds: z.array(z.string().regex(UUID_RE)).min(1).max(MAX_MENTIONS) });

/** `POST /api/groups/{slug}/invite`: notify the tagged readers to join.
 * Moderators only. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const parsed = Invite.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(`Tag 1 to ${MAX_MENTIONS} comrades.`, "readerIds");

  const group = await findGroup((await params).slug);
  if (!group) return groupResponse("not_found");
  return groupResponse(await inviteToGroup(group, reader.readerId, parsed.data.readerIds));
}

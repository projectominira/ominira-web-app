import { z } from "zod";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized, validationError } from "@/lib/api/errors";
import { UUID_RE } from "@/lib/materials/resolve";
import { findGroup, groupResponse } from "@/lib/groups/membership";
import { pinGroupPost } from "@/lib/groups/notes";

const Pin = z.object({ postId: z.string().regex(UUID_RE).nullable() });

/** `PUT /api/groups/{slug}/pin`: pin a note to the top (one per group), or
 * unpin with `postId: null`. Moderators only. */
export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const parsed = Pin.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("postId is required.", "postId");

  const group = await findGroup((await params).slug);
  if (!group) return groupResponse("not_found");
  return groupResponse(await pinGroupPost(group, reader.readerId, parsed.data.postId));
}

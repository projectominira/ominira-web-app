import { z } from "zod";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized, validationError } from "@/lib/api/errors";
import { UUID_RE } from "@/lib/materials/resolve";
import { findGroup, groupResponse, removeMember, setMemberRole } from "@/lib/groups/membership";

type Params = { params: Promise<{ slug: string; readerId: string }> };

const RoleUpdate = z.object({ role: z.enum(["moderator", "member"]) });

/** `PATCH /api/groups/{slug}/members/{readerId}`: Make moderator / step down
 * (M10). Moderators only; 409 for the last moderator. */
export async function PATCH(request: Request, { params }: Params) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const { slug, readerId } = await params;
  const parsed = RoleUpdate.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("role must be moderator or member.", "role");
  if (!UUID_RE.test(readerId)) return groupResponse("not_member");

  const group = await findGroup(slug);
  if (!group) return groupResponse("not_found");
  return groupResponse(await setMemberRole(group.id, reader.readerId, readerId, parsed.data.role));
}

/** `DELETE /api/groups/{slug}/members/{readerId}`: Remove from group (M10).
 * Moderators only. */
export async function DELETE(request: Request, { params }: Params) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const { slug, readerId } = await params;
  if (!UUID_RE.test(readerId)) return groupResponse("not_member");

  const group = await findGroup(slug);
  if (!group) return groupResponse("not_found");
  return groupResponse(await removeMember(group.id, reader.readerId, readerId));
}

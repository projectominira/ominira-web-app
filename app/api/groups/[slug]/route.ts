import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized, validationError } from "@/lib/api/errors";
import { deleteGroup, findGroup, getGroupPage, groupResponse, updateGroup } from "@/lib/groups/membership";
import { GROUP_DESCRIPTION_MAX, GROUP_NAME_MAX } from "@/lib/groups/types";

type Params = { params: Promise<{ slug: string }> };

/** `GET /api/groups/{slug}`: the page header. Public; `myRole` needs a session. */
export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const reader = await getAuthenticatedReader(request);
  const page = await getGroupPage(slug, reader?.readerId ?? null);
  return page ? NextResponse.json(page) : groupResponse("not_found");
}

const GroupUpdate = z
  .object({
    name: z.string().trim().min(1).max(GROUP_NAME_MAX),
    description: z.string().trim().max(GROUP_DESCRIPTION_MAX),
  })
  .partial();

/** `PATCH /api/groups/{slug}`: name and description (M6). Moderators only.
 * A new name renames the slug too; the response carries the one now in use. */
export async function PATCH(request: Request, { params }: Params) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const { slug } = await params;

  const parsed = GroupUpdate.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return validationError(field === "name" ? "Give the group a name." : "That description is too long.", field || undefined);
  }

  const group = await findGroup(slug);
  if (!group) return groupResponse("not_found");
  const outcome = await updateGroup(group.id, reader.readerId, parsed.data);
  return typeof outcome === "string" ? groupResponse(outcome) : NextResponse.json(outcome);
}

/** `DELETE /api/groups/{slug}`: the group and everything in it. Moderators only. */
export async function DELETE(request: Request, { params }: Params) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const { slug } = await params;
  const group = await findGroup(slug);
  if (!group) return groupResponse("not_found");
  return groupResponse(await deleteGroup(group.id, reader.readerId));
}

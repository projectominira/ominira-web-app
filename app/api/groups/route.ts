import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized, validationError } from "@/lib/api/errors";
import { createGroup, groupResponse, listGroups } from "@/lib/groups/membership";
import { GROUP_DESCRIPTION_MAX, GROUP_NAME_MAX } from "@/lib/groups/types";

/** `GET /api/groups`: every group, with `joined` for the viewer. Public. */
export async function GET(request: Request) {
  const reader = await getAuthenticatedReader(request);
  return NextResponse.json({ groups: await listGroups(reader?.readerId ?? null) });
}

const GroupCreate = z.object({
  name: z.string().trim().min(1).max(GROUP_NAME_MAX),
  description: z.string().trim().max(GROUP_DESCRIPTION_MAX).default(""),
});

/** `POST /api/groups`: start a group; you moderate it. Responds with its slug. */
export async function POST(request: Request) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const parsed = GroupCreate.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return validationError(field === "description" ? "That description is too long." : "Give the group a name.", field || undefined);
  }
  const outcome = await createGroup(reader.readerId, parsed.data);
  return typeof outcome === "string" ? groupResponse(outcome) : NextResponse.json(outcome, { status: 201 });
}

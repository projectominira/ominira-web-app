import { z } from "zod";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized, validationError } from "@/lib/api/errors";
import { findGroup, groupResponse, setMuted } from "@/lib/groups/membership";

const Mute = z.object({ muted: z.boolean() });

/** `PUT /api/groups/{slug}/mute`: mute or unmute the group's notifications
 * for yourself. Members only. */
export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const parsed = Mute.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("muted is required.", "muted");

  const group = await findGroup((await params).slug);
  if (!group) return groupResponse("not_found");
  return groupResponse(await setMuted(group.id, reader.readerId, parsed.data.muted));
}

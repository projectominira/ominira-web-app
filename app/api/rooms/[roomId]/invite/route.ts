import { z } from "zod";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { forbidden, notFound, unauthorized, validationError } from "@/lib/api/errors";
import { UUID_RE } from "@/lib/materials/resolve";
import { MAX_MENTIONS } from "@/lib/community/mentions";
import { inviteToRoom } from "@/lib/room/invite";

const Invite = z.object({ readerIds: z.array(z.string().regex(UUID_RE)).min(1).max(MAX_MENTIONS) });

/** `POST /api/rooms/{roomId}/invite`: notify the tagged readers to join the
 * live room. Members of the room only. */
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const { roomId } = await params;
  if (!UUID_RE.test(roomId)) return notFound("No room found.");
  const parsed = Invite.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(`Tag 1 to ${MAX_MENTIONS} comrades.`, "readerIds");

  const outcome = await inviteToRoom(roomId, reader.readerId, parsed.data.readerIds);
  if (outcome === "not_found") return notFound("No live room found.");
  if (outcome === "forbidden") return forbidden("Join the room to invite comrades.");
  return new Response(null, { status: 204 });
}

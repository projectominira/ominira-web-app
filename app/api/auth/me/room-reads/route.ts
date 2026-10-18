import { z } from "zod";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized, validationError } from "@/lib/api/errors";
import { markRoomRead } from "@/lib/rooms/reads";

const Body = z.object({ kind: z.enum(["group", "book"]), roomId: z.uuid() });

/** `POST /api/auth/me/room-reads`: you've read this room to the bottom
 * (rooms-spec §5.2). Debounced by the client. */
export async function POST(request: Request) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return validationError("Expected a room kind and id.");
  await markRoomRead(reader.readerId, body.data.kind, body.data.roomId);
  return new Response(null, { status: 204 });
}

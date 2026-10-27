import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { forbidden, notFound, unauthorized, validationError } from "@/lib/api/errors";
import { UUID_RE } from "@/lib/materials/resolve";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import {
  closeTracks,
  isSessionToken,
  newSession,
  pullMics,
  pushMic,
  renegotiate,
  sessionToken,
  sfuConfigured,
} from "@/lib/room/realtime";

const Sdp = <T extends string>(type: T) => z.object({ type: z.literal(type), sdp: z.string().max(100_000) });
/** A published mic: "<session>/<track>". */
const Address = z.string().max(100).regex(/^[\w-]+\/[\w-]+$/);
const Track = z.string().min(1).max(40).regex(/^[\w-]+$/);
const Owned = { session: z.string().min(1).max(100), token: z.string().min(1).max(100) };

const Body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("session") }),
  z.object({ op: z.literal("push"), ...Owned, offer: Sdp("offer"), mid: z.string().min(1).max(20), track: Track }),
  z.object({ op: z.literal("pull"), ...Owned, publishers: z.array(Address).min(1).max(25) }),
  z.object({ op: z.literal("answer"), ...Owned, answer: Sdp("answer") }),
  z.object({ op: z.literal("close"), ...Owned, mids: z.array(z.string().min(1).max(20)).min(1).max(25), offer: Sdp("offer") }),
]);

/**
 * `POST /api/rooms/{roomId}/audio` — room audio through Cloudflare Realtime
 * (reading-room-spec.md §8.4). `session` opens the reader's one SFU session
 * and returns it with a token; every other op must carry both, so a member
 * can only drive their own session. Cloudflare's result is passed through.
 */
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();

  const { roomId } = await params;
  if (!UUID_RE.test(roomId)) return notFound("No room found.");
  if (!sfuConfigured()) return NextResponse.json({ error: { code: "unavailable", message: "Room audio isn't set up." } }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("Invalid audio request.");
  const body = parsed.data;

  if (body.op === "session") {
    const { data: allowed, error } = await getSupabaseAdminClient().rpc("can_join_room", { room: roomId, reader: reader.readerId });
    if (error) throw error;
    if (!allowed) return forbidden("You're not in this room.");
    const session = await newSession();
    if (!session) return NextResponse.json({ error: { code: "unavailable", message: "Room audio is unavailable." } }, { status: 502 });
    return NextResponse.json({ session, token: sessionToken(reader.readerId, roomId, session) });
  }

  if (!isSessionToken(reader.readerId, roomId, body.session, body.token)) return forbidden("Not your audio session.");
  switch (body.op) {
    case "push":
      return NextResponse.json(await pushMic(body.session, body.offer, body.mid, body.track));
    case "pull":
      return NextResponse.json(await pullMics(body.session, body.publishers));
    case "answer":
      return NextResponse.json(await renegotiate(body.session, body.answer));
    case "close":
      return NextResponse.json(await closeTracks(body.session, body.mids, body.offer));
  }
}

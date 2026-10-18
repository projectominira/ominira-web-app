import { NextResponse } from "next/server";
import { notFound } from "@/lib/api/errors";
import { UUID_RE } from "@/lib/materials/resolve";
import { roomInvite } from "@/lib/room/invite";

/**
 * `GET /api/rooms/{roomId}` — what a room's link shows before you join:
 * the room, its book, who started it, whether it's live and how many are
 * in. Public, signed in or out: rooms run on public books.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!UUID_RE.test(roomId)) return notFound("No room found.");
  const invite = await roomInvite(roomId);
  return invite ? NextResponse.json(invite) : notFound("No room found.");
}

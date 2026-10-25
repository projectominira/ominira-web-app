import { NextResponse } from "next/server";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized } from "@/lib/api/errors";
import { getRoomSuggestions } from "@/lib/rooms/startable";

/** `GET /api/rooms/suggestions` — "Start a room"'s books: yours in
 * progress and those comrades read today (lib/rooms/startable). */
export async function GET(request: Request) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  return NextResponse.json(await getRoomSuggestions(reader.readerId));
}

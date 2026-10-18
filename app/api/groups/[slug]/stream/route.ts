import { NextResponse } from "next/server";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { decodeCursor, type Keyset } from "@/lib/api/cursor";
import { loadPostViewer } from "@/lib/community/viewer";
import { findGroup, groupResponse } from "@/lib/groups/membership";
import { groupStreamPage, pageLimit } from "@/lib/rooms/stream";

/** `GET /api/groups/{slug}/stream?cursor=`: the group's room (rooms-spec
 * §5.1), one page of notes, events and milestones, oldest first. Public,
 * with each viewer's private notes mixed in. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const url = new URL(request.url);
  const [group, reader] = await Promise.all([findGroup((await params).slug), getAuthenticatedReader(request)]);
  if (!group) return groupResponse("not_found");
  const page = await groupStreamPage(group, await loadPostViewer(reader?.readerId), {
    cursor: decodeCursor<Keyset>(url.searchParams.get("cursor")),
    limit: pageLimit(url),
  });
  return NextResponse.json(page);
}

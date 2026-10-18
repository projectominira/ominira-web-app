import { NextResponse } from "next/server";
import { findGroup, groupResponse, listMembers } from "@/lib/groups/membership";

/** `GET /api/groups/{slug}/members`: the Members tab. Public. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const group = await findGroup((await params).slug);
  if (!group) return groupResponse("not_found");
  return NextResponse.json({ members: await listMembers(group.id) });
}

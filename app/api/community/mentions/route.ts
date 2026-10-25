import { NextResponse } from "next/server";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized } from "@/lib/api/errors";
import { mentionCandidates } from "@/lib/community/mentions";
import { findGroup } from "@/lib/groups/membership";

/** `GET /api/community/mentions?q=&group={slug}`: tag suggestions (the
 * composer, the group Invite), or with no `q` who you've engaged with. */
export async function GET(request: Request) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const url = new URL(request.url);
  const slug = url.searchParams.get("group");
  const group = slug ? await findGroup(slug) : null;
  const readers = await mentionCandidates(
    reader.readerId,
    (url.searchParams.get("q") ?? "").slice(0, 60),
    group?.id ?? null
  );
  return NextResponse.json({ readers });
}

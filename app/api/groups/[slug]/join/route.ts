import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized } from "@/lib/api/errors";
import { findGroup, groupResponse, joinGroup } from "@/lib/groups/membership";

/** `POST /api/groups/{slug}/join`: instant and idempotent (spec §4.1). */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const group = await findGroup((await params).slug);
  if (!group) return groupResponse("not_found");
  await joinGroup(group.id, reader.readerId);
  return groupResponse("ok");
}

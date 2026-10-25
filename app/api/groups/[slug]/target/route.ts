import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized, validationError } from "@/lib/api/errors";
import { findGroup, groupResponse } from "@/lib/groups/membership";
import { clearTarget, getTargetView, setTarget } from "@/lib/groups/targets";

type Params = { params: Promise<{ slug: string }> };

/** `GET /api/groups/{slug}/target`: this week's target with the group's
 * progress (the card, day rows, members' words and M7). Public; `mine`
 * needs a session. */
export async function GET(request: Request, { params }: Params) {
  const [group, reader] = await Promise.all([findGroup((await params).slug), getAuthenticatedReader(request)]);
  if (!group) return groupResponse("not_found");
  return NextResponse.json(await getTargetView(group, reader?.readerId ?? null));
}

const TargetInput = z
  .object({
    endPct: z.number().gt(0).max(100),
    endLabel: z.string().trim().min(1).max(120),
    endChapter: z.number().int().positive().nullable(),
    chapterCount: z.number().int().positive().nullable(),
    dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notify: z.boolean(),
  })
  .refine((t) => t.endChapter === null || (t.chapterCount !== null && t.chapterCount >= t.endChapter), {
    path: ["chapterCount"],
  });

/** `PUT /api/groups/{slug}/target`: set this week's target (M7) on the
 * current book, replacing the running one. Moderators only. */
export async function PUT(request: Request, { params }: Params) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const parsed = TargetInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("Choose where to read up to, and by when.", String(parsed.error.issues[0]?.path[0] ?? ""));

  const group = await findGroup((await params).slug);
  if (!group) return groupResponse("not_found");
  return groupResponse(await setTarget(group, reader.readerId, parsed.data));
}

/** `DELETE /api/groups/{slug}/target`: no target this week (5b). Moderators
 * only. */
export async function DELETE(request: Request, { params }: Params) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const group = await findGroup((await params).slug);
  if (!group) return groupResponse("not_found");
  return groupResponse(await clearTarget(group, reader.readerId));
}

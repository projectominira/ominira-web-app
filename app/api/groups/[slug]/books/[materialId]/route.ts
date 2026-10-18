import { z } from "zod";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized, validationError } from "@/lib/api/errors";
import { UUID_RE } from "@/lib/materials/resolve";
import { removeGroupBook, updateGroupBook } from "@/lib/groups/books";
import { findGroup, groupResponse } from "@/lib/groups/membership";

type Params = { params: Promise<{ slug: string; materialId: string }> };

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

// Either a status change or a date range, set together (Edit dates).
const BookUpdate = z.union([
  z.object({ status: z.enum(["current", "done"]) }),
  z
    .object({ startsOn: day, endsOn: day })
    .refine((d) => !d.startsOn || !d.endsOn || d.endsOn >= d.startsOn, { message: "The end date is before the start." }),
]);

/** `PATCH /api/groups/{slug}/books/{materialId}`: Read this now, Mark as
 * done, or Edit dates (M9). Moderators only. */
export async function PATCH(request: Request, { params }: Params) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const { slug, materialId } = await params;
  const parsed = BookUpdate.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? "Invalid update.");
  if (!UUID_RE.test(materialId)) return groupResponse("book_not_found");

  const group = await findGroup(slug);
  if (!group) return groupResponse("not_found");
  return groupResponse(await updateGroupBook(group, reader.readerId, materialId, parsed.data));
}

/** `DELETE /api/groups/{slug}/books/{materialId}`: Remove (M9). Moderators only. */
export async function DELETE(request: Request, { params }: Params) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const { slug, materialId } = await params;
  if (!UUID_RE.test(materialId)) return groupResponse("book_not_found");

  const group = await findGroup(slug);
  if (!group) return groupResponse("not_found");
  return groupResponse(await removeGroupBook(group, reader.readerId, materialId));
}

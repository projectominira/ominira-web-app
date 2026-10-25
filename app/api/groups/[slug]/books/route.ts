import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized, validationError } from "@/lib/api/errors";
import { UUID_RE } from "@/lib/materials/resolve";
import { addGroupBook, listGroupBooks, reorderGroupBooks } from "@/lib/groups/books";
import { findGroup, groupResponse } from "@/lib/groups/membership";

type Params = { params: Promise<{ slug: string }> };

/** `GET /api/groups/{slug}/books`: the reading list (M9). Public. */
export async function GET(_request: Request, { params }: Params) {
  const group = await findGroup((await params).slug);
  if (!group) return groupResponse("not_found");
  return NextResponse.json({ books: await listGroupBooks(group.id) });
}

const BookAdd = z.object({ materialId: z.string().regex(UUID_RE) });

/** `POST /api/groups/{slug}/books`: From library, or after an Upload.
 * Moderators only; public books only. */
export async function POST(request: Request, { params }: Params) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const parsed = BookAdd.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("materialId is required.", "materialId");

  const group = await findGroup((await params).slug);
  if (!group) return groupResponse("not_found");
  return groupResponse(await addGroupBook(group, reader.readerId, parsed.data.materialId));
}

const BookOrder = z.object({ order: z.array(z.string().regex(UUID_RE)).min(1).max(200) });

/** `PUT /api/groups/{slug}/books`: Rearrange, the books in their new order.
 * Moderators only. */
export async function PUT(request: Request, { params }: Params) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const parsed = BookOrder.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("order is required.", "order");

  const group = await findGroup((await params).slug);
  if (!group) return groupResponse("not_found");
  return groupResponse(await reorderGroupBooks(group, reader.readerId, parsed.data.order));
}

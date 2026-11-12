import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthorEdit, editAuthor } from "@/lib/authors/authors";

/** An editor's edit of an author page's draft, and/or its approval (seo-spec C2). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = AuthorEdit.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.uuid().safeParse(id).success) return NextResponse.json({ error: "Please check the fields and try again." }, { status: 400 });
  const ok = await editAuthor(id, parsed.data);
  return ok ? NextResponse.json({ ok }) : NextResponse.json({ error: "That author is gone." }, { status: 404 });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { editReadingList, ReadingListEdit } from "@/lib/readingLists/lists";

/** An editor's edit of a reading list, and/or its approval (seo-spec C1). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = ReadingListEdit.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.uuid().safeParse(id).success) return NextResponse.json({ error: "Please check the fields and try again." }, { status: 400 });
  const ok = await editReadingList(id, parsed.data);
  return ok ? NextResponse.json({ ok }) : NextResponse.json({ error: "That list is gone." }, { status: 404 });
}

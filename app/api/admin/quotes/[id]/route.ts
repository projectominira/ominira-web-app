import { NextResponse } from "next/server";
import { z } from "zod";
import { setQuoteHidden } from "@/lib/quotes/directory";

const PatchSchema = z.object({ hidden: z.boolean() });

/** Hides a quote from the directory, or lists it again (seo-spec C4). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.uuid().safeParse(id).success) return NextResponse.json({ error: "Please try again." }, { status: 400 });
  const ok = await setQuoteHidden(id, parsed.data.hidden);
  return ok ? NextResponse.json({ ok }) : NextResponse.json({ error: "That quote is gone." }, { status: 404 });
}

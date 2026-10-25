import { NextResponse } from "next/server";
import { z } from "zod";
import { setQuestion, setStatus, trimQuote, TrimRanges } from "@/lib/passage/sets";

const PatchSchema = z.union([
  z.object({ ranges: TrimRanges }),
  z.object({ question: z.string().trim().max(280) }),
  z.object({ status: z.enum(["new", "dismissed"]) }),
]);

const notFound = () => NextResponse.json({ error: "That quote is gone." }, { status: 404 });

/** One quote in a set: new words (a trim), its question, or dismiss/restore. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please try again." }, { status: 400 });
  const body = parsed.data;

  if ("ranges" in body) {
    const ranges = await trimQuote(id, body.ranges);
    if (ranges === "not_found") return notFound();
    if (ranges === "invalid") return NextResponse.json({ error: "Select words inside the quote's text." }, { status: 400 });
    return NextResponse.json({ ranges });
  }
  const ok = "question" in body ? await setQuestion(id, body.question) : await setStatus(id, body.status);
  return ok ? NextResponse.json({ ok }) : notFound();
}

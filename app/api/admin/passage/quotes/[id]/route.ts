import { NextResponse } from "next/server";
import { z } from "zod";
import { moveQuote } from "@/lib/passage/calendar";
import { setStatus, trimQuote, TrimRanges } from "@/lib/passage/sets";

const PatchSchema = z.union([
  z.object({ ranges: TrimRanges }),
  z.object({ status: z.enum(["new", "dismissed"]) }),
  z.object({ day: z.iso.date() }),
]);

const notFound = () => NextResponse.json({ error: "That quote is gone." }, { status: 404 });

/** One quote in a set: new words (a trim), dismiss/restore
 * (or unschedule), or a move to another day. */
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
  if ("day" in body) {
    const moved = await moveQuote(id, body.day);
    if (moved === "not_found") return notFound();
    if (moved === "past") return NextResponse.json({ error: "Pick a day in the next 30 that has no passage yet." }, { status: 409 });
    return NextResponse.json(moved);
  }
  const ok = await setStatus(id, body.status);
  return ok ? NextResponse.json({ ok }) : notFound();
}

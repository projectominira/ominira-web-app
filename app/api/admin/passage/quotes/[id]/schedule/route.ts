import { NextResponse } from "next/server";
import { z } from "zod";
import { approveQuote } from "@/lib/passage/calendar";

const ScheduleSchema = z.object({ question: z.string().trim().min(1).max(280), day: z.iso.date().optional() });

const FAILED: Record<string, [string, number]> = {
  not_found: ["That quote is gone.", 404],
  past: ["That day has gone. Pick another.", 409],
  taken: ["That day already has a passage. Pick another.", 409],
  no_question: ["A question is required.", 400],
};

/** Approves a quote for a day (passage-spec §8.3): the one picked, or the
 * day its kind gives it. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = ScheduleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A question is required." }, { status: 400 });
  const outcome = await approveQuote(id, parsed.data.question, parsed.data.day);
  if (typeof outcome === "string") {
    const [error, status] = FAILED[outcome];
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json(outcome);
}

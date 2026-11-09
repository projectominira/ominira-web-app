import { NextResponse } from "next/server";
import { z } from "zod";
import { approveQuote } from "@/lib/passage/calendar";

const ScheduleSchema = z.object({ day: z.iso.date().optional() });

const FAILED: Record<string, [string, number]> = {
  not_found: ["That quote is gone.", 404],
  past: ["That day has gone. Pick another.", 409],
  taken: ["That day already has a passage. Pick another.", 409],
};

/** Approves a quote for a day (passage-spec §8.3): the one picked, or the
 * day its kind gives it. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = ScheduleSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Pick a day in the next 30." }, { status: 400 });
  const outcome = await approveQuote(id, parsed.data.day);
  if (typeof outcome === "string") {
    const [error, status] = FAILED[outcome];
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json(outcome);
}

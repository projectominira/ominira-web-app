import { NextResponse } from "next/server";
import { z } from "zod";
import { saveBrief } from "@/lib/passage/calendar";

const BriefSchema = z.object({ body: z.string().trim().min(1).max(4000) });

/** Saves the editorial brief the connector's `calendar` tool returns. */
export async function PUT(request: Request) {
  const parsed = BriefSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The brief needs 1 to 4,000 characters." }, { status: 400 });
  return NextResponse.json({ updatedAt: await saveBrief(parsed.data.body) });
}

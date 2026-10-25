import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { setTodayFromQuote } from "@/lib/passage/sets";

const UseSchema = z.object({ question: z.string().trim().min(1).max(280) });

const FAILED: Record<string, string> = {
  not_found: "That quote is gone.",
  book_not_found: "The book is no longer public and published.",
  no_official_account: "No reader is marked as the Ominira account.",
};

/** Makes the quote today's passage. "Set by" is the signed-in reader, when
 * the admin is also signed in to Ominira. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = UseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A question is required." }, { status: 400 });
  const reader = await getAuthenticatedReader(request);
  const outcome = await setTodayFromQuote(id, parsed.data.question, reader?.readerId ?? null);
  if (typeof outcome === "string") return NextResponse.json({ error: FAILED[outcome] }, { status: outcome === "not_found" ? 404 : 409 });
  return NextResponse.json(outcome);
}

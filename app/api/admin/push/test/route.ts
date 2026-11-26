import { NextResponse } from "next/server";
import { z } from "zod";
import { BroadcastInput, sendTestEmail } from "@/lib/broadcast/queue";

const TestInput = z.object({ to: z.email().max(200), broadcast: BroadcastInput });

/** "Send a test to me": one copy of the email, subject marked [Test]. */
export async function POST(request: Request) {
  const raw = (await request.json().catch(() => null)) as { to?: unknown; broadcast?: Record<string, unknown> } | null;
  // A test is always one email, whatever the form's Send via says.
  const parsed = TestInput.safeParse({ ...raw, broadcast: { ...raw?.broadcast, channels: ["email"], sendAt: null } });
  if (!parsed.success) {
    // Name the field, so a refused test says what to fix.
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".") || "request";
    console.warn("[broadcast test] refused", field, issue?.message);
    const error = field === "to" ? "That email address doesn’t look right." : `The test couldn’t be sent: ${field} (${issue?.message}).`;
    return NextResponse.json({ error }, { status: 400 });
  }
  const error = await sendTestEmail(parsed.data.broadcast, parsed.data.to);
  if (error) console.warn("[broadcast test] not sent", error);
  return error ? NextResponse.json({ error }, { status: 400 }) : NextResponse.json({ ok: true });
}

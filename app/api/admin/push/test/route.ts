import { NextResponse } from "next/server";
import { z } from "zod";
import { BroadcastInput, sendTestEmail } from "@/lib/broadcast/queue";

const TestInput = z.object({ to: z.email().max(200), broadcast: BroadcastInput });

/** "Send a test to me": one copy of the email, subject marked [Test]. */
export async function POST(request: Request) {
  const parsed = TestInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the email address and the broadcast, then try again." }, { status: 400 });
  const error = await sendTestEmail(parsed.data.broadcast, parsed.data.to);
  return error ? NextResponse.json({ error }, { status: 400 }) : NextResponse.json({ ok: true });
}

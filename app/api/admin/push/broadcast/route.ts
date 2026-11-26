import { NextResponse } from "next/server";
import { z } from "zod";
import { isCorrectPushPin } from "@/lib/admin/pin";
import { BroadcastInput, createBroadcast } from "@/lib/broadcast/queue";

// Auth: every /api/admin route sits behind the admin PIN gate (proxy.ts);
// sending additionally needs PUSH_SEND_PIN, checked per request below.

// "Send now" sends the push and the first email batches in this request.
export const maxDuration = 300;

const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// Same per-instance brute-force brake as app/admin/unlock/actions.ts —
// in-memory, so a speed bump rather than a hard limit.
const pinFailures = new Map<string, { count: number; until: number }>();

/** Sends a broadcast now, or schedules it (lib/broadcast/queue.ts). */
export async function POST(request: Request) {
  const raw = (await request.json().catch(() => null)) as { pin?: unknown } | null;
  const parsed = BroadcastInput.safeParse(raw);
  const pin = z.string().max(100).safeParse(raw?.pin);
  if (!parsed.success || !pin.success) {
    return NextResponse.json(
      { error: "A title, a message and at least one channel are required, and a link must be an in-app path or an https:// URL." },
      { status: 400 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const record = pinFailures.get(ip);
  if (record && record.count >= MAX_PIN_ATTEMPTS && record.until > now) {
    return NextResponse.json({ error: "Too many wrong PINs. Try again in 15 minutes.", code: "pin" }, { status: 429 });
  }
  if (!isCorrectPushPin(pin.data)) {
    const count = record && record.until > now ? record.count + 1 : 1;
    pinFailures.set(ip, { count, until: now + LOCKOUT_MS });
    const error = count >= MAX_PIN_ATTEMPTS ? "Too many wrong PINs. Try again in 15 minutes." : "That send PIN isn't right.";
    return NextResponse.json({ error, code: "pin" }, { status: 403 });
  }
  pinFailures.delete(ip);

  const result = await createBroadcast(parsed.data);
  if (typeof result === "string") return NextResponse.json({ error: result }, { status: 400 });
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { BroadcastInput, renderBroadcastEmail } from "@/lib/broadcast/queue";

/** The email exactly as members will get it, for the compose page's preview. */
export async function POST(request: Request) {
  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  // Previews are drawn while typing: fill what isn't written yet.
  const parsed = BroadcastInput.safeParse({ channels: ["email"], ...raw, title: (raw?.title as string)?.trim() || "Title", body: (raw?.body as string)?.trim() || "Message" });
  if (!parsed.success) return new NextResponse("", { status: 400 });
  const email = await renderBroadcastEmail(parsed.data);
  if (typeof email === "string") return new NextResponse(email, { status: 404 });
  return new NextResponse(email.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

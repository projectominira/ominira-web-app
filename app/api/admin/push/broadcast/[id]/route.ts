import { NextResponse } from "next/server";
import { z } from "zod";
import { stopBroadcast } from "@/lib/broadcast/queue";

/** Stops a scheduled broadcast, or the emails a sending one has left. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "No such broadcast." }, { status: 404 });
  return (await stopBroadcast(id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "It has already finished." }, { status: 409 });
}

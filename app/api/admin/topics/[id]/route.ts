import { NextResponse } from "next/server";
import { z } from "zod";
import { editTopic, removeTopic, TopicEdit } from "@/lib/topics/guides";

/** An editor's edit of a topic guide (seo-spec C3). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = TopicEdit.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.uuid().safeParse(id).success) return NextResponse.json({ error: "Please check the fields and try again." }, { status: 400 });
  const ok = await editTopic(id, parsed.data);
  return ok ? NextResponse.json({ ok }) : NextResponse.json({ error: "That guide is gone." }, { status: 404 });
}

/** Takes a topic guide off the site. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "That guide is gone." }, { status: 404 });
  const ok = await removeTopic(id);
  return ok ? NextResponse.json({ ok }) : NextResponse.json({ error: "That guide is gone." }, { status: 404 });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { conflict, unauthorized, validationError } from "@/lib/api/errors";
import { REQUEST_LIMITS, firstLink, type BookRequest } from "@/lib/materials/suggestions";

const COLUMNS = "id, title, status, created_at";

type Row = { id: string; title: string; status: BookRequest["status"]; created_at: string };

const toRequest = (r: Row): BookRequest => ({ id: r.id, text: r.title, status: r.status, createdAt: r.created_at });

const Schema = z.object({ text: z.string().trim().min(1, "Tell us what you're looking for.").max(REQUEST_LIMITS.text) });

/** `GET /api/materials/suggestions` — the signed-in reader's own requests, newest first. */
export async function GET(request: Request) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();

  const { data } = await getSupabaseAdminClient()
    .from("pending_materials")
    .select(COLUMNS)
    .eq("reader_id", reader.readerId)
    .eq("submission_type", "suggestion")
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ items: ((data ?? []) as Row[]).map(toRequest) });
}

/** `POST /api/materials/suggestions` — a reader asks for something the
 * library doesn't have, in their own words. Worked through in
 * /admin/library/suggestions; marking it added notifies them. */
export async function POST(request: Request) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? "Please try again.", "text");
  const text = parsed.data.text;

  const admin = getSupabaseAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [same, today] = await Promise.all([
    admin
      .from("pending_materials")
      .select(COLUMNS)
      .eq("reader_id", reader.readerId)
      .eq("submission_type", "suggestion")
      .eq("status", "pending")
      .eq("title", text)
      .limit(1),
    admin
      .from("pending_materials")
      .select("id", { count: "exact", head: true })
      .eq("reader_id", reader.readerId)
      .eq("submission_type", "suggestion")
      .gte("created_at", since),
  ]);

  // Asking twice is fine — it's already on the list.
  if (same.data?.[0]) return NextResponse.json({ item: toRequest(same.data[0] as Row) });
  if ((today.count ?? 0) >= REQUEST_LIMITS.perDay) return conflict("That's plenty for today — we're on it. Try again tomorrow.");

  const { data, error } = await admin
    .from("pending_materials")
    .insert({ submission_type: "suggestion", title: text, source_url: firstLink(text), reader_id: reader.readerId })
    .select(COLUMNS)
    .single();

  if (error || !data) return NextResponse.json({ error: { code: "unknown", message: "That didn't go through. Please try again." } }, { status: 500 });
  return NextResponse.json({ item: toRequest(data as Row) }, { status: 201 });
}

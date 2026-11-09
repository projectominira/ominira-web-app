import type { Metadata } from "next";
import SuggestionsAdminView from "./SuggestionsAdminView";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book requests",
  robots: { index: false, follow: false },
};

export default async function AdminSuggestionsPage() {
  const admin = getSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("pending_materials")
    .select("id, title, source_url, reader_id, status, created_at")
    .eq("submission_type", "suggestion")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load suggestions: ${error.message}`);

  const readerIds = [...new Set((rows ?? []).map((r) => r.reader_id).filter((id): id is string => !!id))];
  const { data: readers } = readerIds.length
    ? await admin.from("readers").select("id, pseudonym").in("id", readerIds)
    : { data: [] as { id: string; pseudonym: string }[] };
  const pseudonyms = new Map((readers ?? []).map((r) => [r.id, r.pseudonym]));

  return (
    <SuggestionsAdminView
      suggestions={(rows ?? []).map((r) => ({
        id: r.id,
        text: r.title,
        url: r.source_url,
        by: (r.reader_id && pseudonyms.get(r.reader_id)) || null,
        status: r.status,
        createdAt: r.created_at,
      }))}
    />
  );
}

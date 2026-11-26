import type { Metadata } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import SentView from "../SentView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sent broadcasts",
  robots: { index: false, follow: false },
};

export default async function AdminSentBroadcastsPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  const { data, error } = await getSupabaseAdminClient()
    .from("push_broadcasts")
    .select("id, kind, title, body, url, channels, audience, status, send_at, recipient_count, failure_count, email_recipient_count, email_sent_count, email_failure_count")
    .order("send_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Could not load broadcasts: ${error.message}`);
  return <SentView broadcasts={data} sentId={sent ?? null} />;
}

import type { Metadata } from "next";
import BroadcastHistoryView from "./BroadcastHistoryView";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Broadcast admin",
  robots: { index: false, follow: false },
};

export default async function AdminPushPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  const { data, error } = await getSupabaseAdminClient()
    .from("push_broadcasts")
    .select("id, title, body, url, recipient_count, failure_count, channels, email_recipient_count, email_failure_count, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Could not load broadcast history: ${error.message}`);
  return <BroadcastHistoryView broadcasts={data ?? []} sentId={sent ?? null} />;
}

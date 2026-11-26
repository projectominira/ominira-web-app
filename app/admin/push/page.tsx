import type { Metadata } from "next";
import { broadcastAudience } from "@/lib/broadcast/queue";
import { isResendConfigured } from "@/lib/email/resend";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import ComposeView from "./ComposeView";
import type { ListOption } from "./DestinationPicker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Broadcast",
  robots: { index: false, follow: false },
};

/** A new broadcast: a title, a message and a link (a reading list adds its
 * books to the email), now or later. `reuse` starts from a past one. */
export default async function AdminBroadcastPage({ searchParams }: { searchParams: Promise<{ reuse?: string }> }) {
  const { reuse } = await searchParams;
  const db = getSupabaseAdminClient();
  const [audience, lists, reused] = await Promise.all([
    broadcastAudience(),
    db.from("reading_lists").select("id, slug, title, day, books").eq("status", "approved").order("day", { ascending: false }).limit(24),
    reuse ? db.from("push_broadcasts").select("title, body, url, channels, audience, reading_list_id").eq("id", reuse).maybeSingle() : null,
  ]);
  if (lists.error) throw lists.error;
  const options: ListOption[] = lists.data.map((l) => ({ id: l.id, slug: l.slug, title: l.title, day: l.day, books: Array.isArray(l.books) ? l.books.length : 0 }));
  return <ComposeView audience={audience} lists={options} emailEnabled={isResendConfigured()} reuse={reused?.data ?? null} />;
}

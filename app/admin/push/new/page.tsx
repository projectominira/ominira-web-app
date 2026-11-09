import type { Metadata } from "next";
import ComposeView from "./ComposeView";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { isResendConfigured } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New broadcast",
  robots: { index: false, follow: false },
};

export default async function AdminNewBroadcastPage({ searchParams }: { searchParams: Promise<{ reuse?: string }> }) {
  const { reuse } = await searchParams;
  const admin = getSupabaseAdminClient();
  // Audience figures are head-only counts — no rows cross the wire.
  const [members, devices, emailSubscribers, reused] = await Promise.all([
    admin.from("readers").select("id", { count: "exact", head: true }),
    admin.from("push_subscriptions").select("id", { count: "exact", head: true }),
    admin.from("readers").select("id", { count: "exact", head: true }).eq("email_announcements", true),
    reuse ? admin.from("push_broadcasts").select("title, body, url, channels").eq("id", reuse).maybeSingle() : null,
  ]);

  return (
    <ComposeView
      audience={{ members: members.count ?? 0, devices: devices.count ?? 0, emailSubscribers: emailSubscribers.count ?? 0 }}
      emailEnabled={isResendConfigured()}
      reuse={reused?.data ?? null}
    />
  );
}

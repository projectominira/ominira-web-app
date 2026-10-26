import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { getWebPush } from "@/lib/push/vapid";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  // Same tag collapses multiple notifications into one — e.g. five reactions
  // on the same note in a minute shouldn't stack five system notifications.
  tag?: string;
  // Optional overrides for icon/badge — defaults to the Ominira mark
  // in sw.js if omitted.
  icon?: string;
  badge?: string;
  // The reader's unread notifications, for the app icon's badge (sw.js);
  // absent on a broadcast, which leaves the badge as it is.
  badgeCount?: number;
};

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

const BROADCAST_BATCH_SIZE = 200;

// Sends to one subscription row; on a 404/410 (gone/expired) deletes it so
// the table stays clean without a separate cron job. Never throws — a push
// failure must not surface as an API error to the caller that triggered it.
// Returns whether the send itself succeeded, for sendBroadcast's tally —
// event-triggered callers (sendToReaders) tally it too, for the cron's logs.
async function sendToSubscription(row: SubscriptionRow, payload: PushPayload): Promise<boolean> {
  try {
    await getWebPush().sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      JSON.stringify(payload)
    );
    return true;
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await getSupabaseAdminClient().from("push_subscriptions").delete().eq("id", row.id);
    } else {
      console.warn("push send failed", { subscriptionId: row.id, statusCode, error });
    }
    return false;
  }
}

async function sendToRows(rows: SubscriptionRow[], payload: PushPayload) {
  const results = await Promise.allSettled(rows.map((row) => sendToSubscription(row, payload)));
  return results.filter((result) => result.status === "fulfilled" && result.value).length;
}

// Only called through lib/notifications (notifyReader/notifyReaders), never
// straight from a route — that's what keeps the in-app row, push and email
// in step. Best-effort, like every send here. Each push carries its reader's
// unread count (the notification rows are written first), counted in one
// query for the readers with a device. Returns how many devices accepted it.
export async function sendToReaders(readerIds: string[], payload: PushPayload): Promise<number> {
  if (readerIds.length === 0) return 0;
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth, reader_id").in("reader_id", readerIds);
  if (!data?.length) return 0;
  const { data: counts } = await admin.rpc("unread_notification_counts", { readers: [...new Set(data.flatMap((row) => (row.reader_id ? [row.reader_id] : [])))] });
  // No counts (the read failed): the badge is left as it is.
  const unread = counts && new Map(counts.map((c) => [c.reader_id, c.unread]));
  const badge = (readerId: string | null) => (unread ? { badgeCount: (readerId && unread.get(readerId)) || 0 } : {});
  const results = await Promise.allSettled(data.map((row) => sendToSubscription(row, { ...payload, ...badge(row.reader_id) })));
  return results.filter((result) => result.status === "fulfilled" && result.value).length;
}

// Everyone with a live subscription — installed PWA or plain web. Paginated
// so a large table doesn't open thousands of concurrent HTTPS requests at
// once; each page is still sent with allSettled so one bad batch member
// never blocks the rest. Returns tallies so the caller (the admin broadcast
// route) can record a push_broadcasts history row. Keyset-paged on id, not
// offset: sendToSubscription deletes expired rows mid-loop, which would
// shift later rows under an offset and silently skip them.
export async function sendBroadcast(payload: PushPayload): Promise<{ recipientCount: number; failureCount: number }> {
  const admin = getSupabaseAdminClient();
  let after: string | null = null;
  let recipientCount = 0;
  let succeeded = 0;
  for (;;) {
    let query = admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").order("id").limit(BROADCAST_BATCH_SIZE);
    if (after) query = query.gt("id", after);
    const { data } = await query;
    if (!data?.length) break;
    recipientCount += data.length;
    succeeded += await sendToRows(data, payload);
    if (data.length < BROADCAST_BATCH_SIZE) break;
    after = data[data.length - 1].id;
  }
  return { recipientCount, failureCount: recipientCount - succeeded };
}

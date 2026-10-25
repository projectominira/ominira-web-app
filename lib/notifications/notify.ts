import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { sendToReaders } from "@/lib/push/send";
import { announcementEmail } from "@/lib/email/broadcast";
import { RESEND_BATCH_MAX, isResendConfigured, sendBatch } from "@/lib/email/resend";
import { NOTIFICATION_POLICY } from "@/lib/notifications/policy";
import type { NotificationKind } from "@/lib/notifications/types";

export type NotifyPayload = {
  kind: NotificationKind;
  title: string;
  body: string;
  url: string;
  // Collapses duplicate pushes (e.g. five reactions on the same note in a
  // minute) — the in-app row always gets its own entry regardless, since a
  // reader's notification feed should show each event, not just each push.
  tag?: string;
  icon?: string;
  badge?: string;
  // In-app-only enrichment (Notifications page): who triggered this, and a
  // frozen copy of the text it was about. Neither travels in the push
  // payload — a push only ever shows title/body — so they're written to the
  // `notifications` row and dropped before sendToReaders.
  actorReaderId?: string;
  snippet?: string | null;
  // What this is about (a session, a room, a note), for kinds whose policy
  // dedupes: one delivery per (kind, ref, reader, day). Also seeds the email
  // idempotency key.
  ref?: string;
  // The group it's from, for kinds a member can mute (policy.groupMute).
  groupId?: string;
};

// Readers per pass — one Resend batch, and a short `in (...)` list for push.
const CHUNK = RESEND_BATCH_MAX;

/** What went out: readers notified (after dedupe), devices pushed, emails
 * Resend accepted. */
export type NotifyTally = { readers: number; pushed: number; emailed: number };

/** The one place an event becomes an in-app row, a push and, where the
 * kind's policy says so (policy.ts), an email — so the channels can never
 * drift apart. Callers fire and forget (`void`), never awaiting it into a
 * response. */
export function notifyReader(readerId: string, payload: NotifyPayload): Promise<NotifyTally> {
  return notifyReaders([readerId], payload);
}

/** notifyReader for many readers at once, in chunks: one insert, one
 * subscription lookup and one email batch per chunk. */
export async function notifyReaders(readerIds: string[], payload: NotifyPayload): Promise<NotifyTally> {
  const tally: NotifyTally = { readers: 0, pushed: 0, emailed: 0 };
  const unique = [...new Set(readerIds)];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = await deliver(unique.slice(i, i + CHUNK), payload);
    tally.readers += chunk.readers;
    tally.pushed += chunk.pushed;
    tally.emailed += chunk.emailed;
  }
  return tally;
}

async function deliver(readerIds: string[], payload: NotifyPayload): Promise<NotifyTally> {
  const admin = getSupabaseAdminClient();
  const policy = NOTIFICATION_POLICY[payload.kind];
  const { kind, actorReaderId, snippet, ref, groupId, ...push } = payload;

  // Members who muted the group get nothing of its kinds (a mention still
  // reaches them: its policy doesn't mute).
  if (policy.groupMute && groupId) {
    const { data, error } = await admin.from("group_members").select("reader_id").eq("group_id", groupId).eq("muted", true).in("reader_id", readerIds);
    if (error) throw error;
    const muted = new Set(data.map((m) => m.reader_id));
    readerIds = readerIds.filter((id) => !muted.has(id));
    if (!readerIds.length) return { readers: 0, pushed: 0, emailed: 0 };
  }

  // Claim first: only readers whose claim is new get anything, so a retry
  // or an overlapping cron run is a no-op.
  if (policy.dedupe && ref) {
    const { data } = await admin
      .from("notification_deliveries")
      .upsert(
        readerIds.map((reader_id) => ({ kind, ref, reader_id })),
        { onConflict: "kind,ref,reader_id,sent_on", ignoreDuplicates: true }
      )
      .select("reader_id");
    readerIds = (data ?? []).map((row) => row.reader_id);
  }
  if (!readerIds.length) return { readers: 0, pushed: 0, emailed: 0 };

  await admin.from("notifications").insert(
    readerIds.map((reader_id) => ({
      reader_id,
      kind,
      title: payload.title,
      body: payload.body,
      url: payload.url,
      actor_reader_id: actorReaderId ?? null,
      snippet: snippet ?? null,
    }))
  );

  const [pushed, emailed] = await Promise.all([
    policy.push ? sendToReaders(readerIds, push) : 0,
    policy.email ? email(readerIds, payload) : 0,
  ]);
  return { readers: readerIds.length, pushed, emailed };
}

async function email(readerIds: string[], payload: NotifyPayload): Promise<number> {
  if (!isResendConfigured()) return 0;
  const { data } = await getSupabaseAdminClient()
    .from("readers")
    .select("id, email")
    .in("id", readerIds)
    .eq("email_announcements", true);
  if (!data?.length) return 0;
  const message = { title: payload.title, body: payload.body, url: payload.url };
  // Deterministic for a deduped send, so Resend drops a retried batch too.
  const key = `${payload.kind}-${payload.ref ?? crypto.randomUUID()}-${data[0].id}`;
  return sendBatch(data.map((reader) => announcementEmail(reader, message)), key);
}

// A broadcast's in-app side: one notifications row per reader (not per push
// subscription — a logged-in reader without notification permission should
// still see it in their feed). Push delivery itself stays on
// push_subscriptions via sendBroadcast (lib/push/send.ts); these are two
// separate recipient lists on purpose.
export async function notifyAllReaders(payload: Omit<NotifyPayload, "kind" | "tag" | "ref">) {
  const admin = getSupabaseAdminClient();
  // Keyset-paged on id — an unordered offset range isn't guaranteed stable
  // across pages, so readers could be skipped or notified twice.
  let after: string | null = null;
  for (;;) {
    let query = admin.from("readers").select("id").order("id").limit(CHUNK);
    if (after) query = query.gt("id", after);
    const { data } = await query;
    if (!data?.length) break;
    await notifyReaders(
      data.map((reader) => reader.id),
      { ...payload, kind: "broadcast" }
    );
    if (data.length < CHUNK) break;
    after = data[data.length - 1].id;
  }
}

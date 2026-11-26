import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import type { EmailBook } from "@/lib/email/announcement";
import { announcementEmail } from "@/lib/email/broadcast";
import { RESEND_BATCH_MAX, isResendConfigured, sendBatch } from "@/lib/email/resend";
import { notifyAllReaders } from "@/lib/notifications/notify";
import { sendBroadcast } from "@/lib/push/send";
import { readingListForEmail } from "@/lib/readingLists/lists";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import type { Database } from "@/lib/supabase/database.types";

// Admin broadcasts (/admin/push). A broadcast starts at send_at (now, or
// scheduled; the 5-minute cron starts due ones): the push and the feed row
// go to everyone at once; email is queued per recipient (broadcast_emails)
// and sent in batches of EMAIL_BATCH_SIZE, at most EMAIL_DAILY_LIMIT a UTC
// day. Resend's free plan allows 100 a day; 80 leaves room for session
// reminders. On a paid plan, raise EMAIL_DAILY_LIMIT and it all goes the
// same day. migrations/20261218_broadcast_queue.sql.

export const EMAIL_DAILY_LIMIT = Number(process.env.EMAIL_DAILY_LIMIT) || 80;
const EMAIL_BATCH_SIZE = Math.min(Number(process.env.EMAIL_BATCH_SIZE) || 50, RESEND_BATCH_MAX);

const db = () => getSupabaseAdminClient();

type Broadcast = Database["public"]["Tables"]["push_broadcasts"]["Row"];

export const BroadcastInput = z.object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(500),
    // An in-app path or an https link (what sw.js can open); empty for none.
    // Linking a reading list (readingListId) uses its page, and the email
    // shows its books under the message.
    url: z.string().trim().max(500).regex(/^$|^\/(?!\/)\S*$|^https:\/\/\S+$/).default(""),
    readingListId: z.uuid().nullable().default(null),
    channels: z.array(z.enum(["push", "email"])).min(1).max(2),
    audience: z.enum(["everyone", "opted_in"]).default("everyone"),
    /** ISO time; absent or past means now. */
    sendAt: z.iso.datetime({ offset: true }).nullable().default(null),
  });
export type BroadcastInput = z.infer<typeof BroadcastInput>;

type Content = Pick<BroadcastInput, "title" | "body" | "url" | "readingListId">;

/** The content of a broadcast, as sent: a linked reading list's page is its link. */
async function content(input: Content) {
  const list = input.readingListId ? await readingListForEmail(input.readingListId) : null;
  if (input.readingListId && !list) return "That reading list is gone.";
  return { message: { title: input.title, body: input.body, url: list?.url ?? input.url }, books: list?.books ?? [] };
}

/** Saves a broadcast to start at its time, and starts it if that's now.
 * A string is a problem to show the editor. */
export async function createBroadcast(raw: BroadcastInput): Promise<{ id: string } | string> {
  const input = BroadcastInput.parse(raw);
  const sendAt = input.sendAt ? new Date(input.sendAt) : new Date();
  if (sendAt.getTime() > Date.now() + 60 * 86400_000) return "Schedule it within the next 60 days.";
  if (input.channels.includes("email") && !isResendConfigured()) return "Email isn't set up: RESEND_API_KEY is missing.";
  const c = await content(input);
  if (typeof c === "string") return c;
  const { data, error } = await db()
    .from("push_broadcasts")
    .insert({
      ...c.message,
      kind: input.readingListId ? "reading_list" : "message",
      reading_list_id: input.readingListId,
      channels: [...new Set(input.channels)],
      audience: input.audience,
      send_at: sendAt.toISOString(),
      status: "scheduled",
      recipient_count: 0,
    })
    .select("id")
    .single();
  if (error) throw error;
  if (sendAt.getTime() <= Date.now()) await runBroadcasts();
  return { id: data.id };
}

/** Starts what's due and sends the next emails. The cron calls it every 5
 * minutes; safe to call twice (each broadcast starts once, each email is
 * claimed once). */
export async function runBroadcasts(): Promise<{ started: number; emailed: number }> {
  const { data: due, error } = await db()
    .from("push_broadcasts")
    .update({ status: "sending" })
    .eq("status", "scheduled")
    .lte("send_at", new Date().toISOString())
    .select("*");
  if (error) throw error;
  for (const b of due) await start(b);
  return { started: due.length, emailed: await drainEmails() };
}

async function start(b: Broadcast) {
  const push = b.channels.includes("push")
    ? await Promise.all([sendBroadcast({ title: b.title, body: b.body, url: b.url || "/home" }), notifyAllReaders({ title: b.title, body: b.body, url: b.url || "/home" })]).then(([tally]) => tally)
    : { recipientCount: 0, failureCount: 0 };
  let queued = 0;
  if (b.channels.includes("email")) {
    const { data, error } = await db().rpc("enqueue_broadcast_emails", { p_broadcast: b.id });
    if (error) throw error;
    queued = data;
  }
  await db()
    .from("push_broadcasts")
    .update({ recipient_count: push.recipientCount, failure_count: push.failureCount, email_recipient_count: queued, status: queued > 0 ? "sending" : "sent" })
    .eq("id", b.id);
}

/** Sends queued emails, a batch at a time, until the queue or the day's
 * allowance runs out (or a minute passes). Returns how many went. */
export async function drainEmails(deadline = Date.now() + 60_000): Promise<number> {
  if (!isResendConfigured()) return 0;
  let sent = 0;
  while (Date.now() < deadline) {
    const { data: claimed, error } = await db().rpc("claim_broadcast_emails", { p_batch: EMAIL_BATCH_SIZE, p_daily: EMAIL_DAILY_LIMIT });
    if (error) throw error;
    if (!claimed.length) break;
    const result = await sendClaimed(claimed);
    sent += result;
    // Nothing accepted (quota, outage): try again on the next run.
    if (result === 0) break;
  }
  return sent;
}

type Claimed = { broadcast_id: string; reader_id: string; attempts: number };

async function sendClaimed(claimed: Claimed[]): Promise<number> {
  const broadcastIds = [...new Set(claimed.map((c) => c.broadcast_id))];
  const [broadcasts, readers] = await Promise.all([
    db().from("push_broadcasts").select("*").in("id", broadcastIds),
    db().from("readers").select("id, email, email_unsubscribed").in("id", claimed.map((c) => c.reader_id)),
  ]);
  if (broadcasts.error) throw broadcasts.error;
  if (readers.error) throw readers.error;
  const byId = new Map(broadcasts.data.map((b) => [b.id, b]));
  const readerById = new Map(readers.data.map((r) => [r.id, r]));
  const books = new Map<string, EmailBook[]>();
  for (const b of broadcasts.data) if (b.reading_list_id) books.set(b.id, (await readingListForEmail(b.reading_list_id))?.books ?? []);

  const toSend: Claimed[] = [];
  const skipped: Claimed[] = [];
  const emails = claimed.flatMap((c) => {
    const b = byId.get(c.broadcast_id);
    const r = readerById.get(c.reader_id);
    if (!b || b.status !== "sending" || !r?.email || r.email_unsubscribed) return skipped.push(c), [];
    toSend.push(c);
    return [announcementEmail({ id: r.id, email: r.email }, b, books.get(b.id))];
  });

  let accepted = 0;
  if (emails.length) {
    // The same rows give the same key, so a retried batch isn't sent twice.
    const key = createHash("sha256").update(toSend.map((c) => `${c.broadcast_id}:${c.reader_id}`).join(",")).digest("base64url");
    accepted = await sendBatch(emails, `broadcast-${key}`);
  }
  await Promise.all([
    mark(skipped, "skipped"),
    accepted ? mark(toSend, "sent") : Promise.all([mark(toSend.filter((c) => c.attempts >= 3), "failed"), mark(toSend.filter((c) => c.attempts < 3), "queued")]),
  ]);
  await Promise.all(broadcastIds.map(refreshCounts));
  return accepted;
}

async function mark(rows: Claimed[], status: "sent" | "failed" | "queued" | "skipped") {
  for (const id of new Set(rows.map((r) => r.broadcast_id))) {
    const readers = rows.filter((r) => r.broadcast_id === id).map((r) => r.reader_id);
    const { error } = await db().from("broadcast_emails").update({ status }).eq("broadcast_id", id).in("reader_id", readers);
    if (error) throw error;
  }
}

const countOf = async (id: string, statuses: Database["public"]["Tables"]["broadcast_emails"]["Row"]["status"][]) => {
  const { count, error } = await db().from("broadcast_emails").select("reader_id", { count: "exact", head: true }).eq("broadcast_id", id).in("status", statuses);
  if (error) throw error;
  return count ?? 0;
};

/** The history's tallies, and 'sent' once nothing is left to send. */
async function refreshCounts(id: string) {
  const [sent, failed, left] = await Promise.all([countOf(id, ["sent"]), countOf(id, ["failed"]), countOf(id, ["queued", "sending"])]);
  const update = { email_sent_count: sent, email_failure_count: failed };
  await db()
    .from("push_broadcasts")
    .update(left === 0 ? { ...update, status: "sent" as const } : update)
    .eq("id", id)
    .eq("status", "sending");
}

/** Stops a scheduled broadcast, or the emails a sending one has left. */
export async function stopBroadcast(id: string): Promise<boolean> {
  const { data, error } = await db().from("push_broadcasts").update({ status: "stopped" }).eq("id", id).in("status", ["scheduled", "sending"]).select("id");
  if (error) throw error;
  if (!data.length) return false;
  await db().from("broadcast_emails").update({ status: "skipped" }).eq("broadcast_id", id).eq("status", "queued");
  return true;
}

/** The email as members will get it, for the compose page's preview and the
 * test send. The unsubscribe link in it goes nowhere. */
export async function renderBroadcastEmail(input: Content) {
  const c = await content(input);
  if (typeof c === "string") return c;
  return announcementEmail({ id: "preview", email: "preview@example.com" }, c.message, c.books);
}

/** Sends one copy to `to`, marked as a test. */
export async function sendTestEmail(input: Content, to: string): Promise<string | null> {
  if (!isResendConfigured()) return "Email isn't set up: RESEND_API_KEY is missing.";
  const email = await renderBroadcastEmail(input);
  if (typeof email === "string") return email;
  const ok = await sendBatch([{ ...email, to: [to], subject: `[Test] ${email.subject}` }], `broadcast-test-${crypto.randomUUID()}`);
  return ok ? null : "Resend didn't accept it. Try again in a minute.";
}

/** What the compose page needs to say who gets it and when. */
export async function broadcastAudience() {
  const readers = () => db().from("readers").select("id", { count: "exact", head: true });
  const [devices, members, everyone, optedIn, today, queued] = await Promise.all([
    db().from("push_subscriptions").select("id", { count: "exact", head: true }),
    readers(),
    readers().not("email", "is", null).eq("email_unsubscribed", false),
    readers().not("email", "is", null).eq("email_unsubscribed", false).eq("email_announcements", true),
    db().rpc("broadcast_emails_today"),
    db().from("broadcast_emails").select("reader_id", { count: "exact", head: true }).in("status", ["queued", "sending"]),
  ]);
  return {
    devices: devices.count ?? 0,
    members: members.count ?? 0,
    everyone: everyone.count ?? 0,
    optedIn: optedIn.count ?? 0,
    sentToday: today.data ?? 0,
    queued: queued.count ?? 0,
    dailyLimit: EMAIL_DAILY_LIMIT,
  };
}
export type BroadcastAudience = Awaited<ReturnType<typeof broadcastAudience>>;

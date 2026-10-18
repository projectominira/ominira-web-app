import type { NotificationKind } from "@/lib/notifications/types";

/**
 * How each kind is delivered (studygroup-spec.md §0.2, §7). notify.ts reads
 * this and nothing else, so adding a kind is one entry here. The in-app row
 * is always written.
 *
 * - `push`: to the reader's push subscriptions (lib/push/send.ts).
 * - `email`: the announcement layout (lib/email), only to readers who keep
 *   email on (`readers.email_announcements`), with its unsubscribe link.
 * - `groupMute`: skipped for members who muted the group (spec §7).
 * - `dedupe`: one delivery per (kind, ref, reader, day), claimed in
 *   `notification_deliveries`; the caller's `ref` names what it's about
 *   (a session, a room, a note).
 */
export type NotificationPolicy = {
  push: boolean;
  email: boolean;
  groupMute: boolean;
  dedupe: boolean;
};

const inAppOnly: NotificationPolicy = { push: false, email: false, groupMute: false, dedupe: false };
const push: NotificationPolicy = { ...inAppOnly, push: true };
const groupPush: NotificationPolicy = { ...push, groupMute: true, dedupe: true };
const groupPushEmail: NotificationPolicy = { ...groupPush, email: true };

export const NOTIFICATION_POLICY: Record<NotificationKind, NotificationPolicy> = {
  reaction: push,
  reply: push,
  material_reaction: push,
  // Written in SQL (the topic digest trigger), listed so every kind is here.
  digest: inAppOnly,
  // Admin broadcasts push to every device (sendBroadcast) and email opted-in
  // readers (sendEmailBroadcast) with their own tallies; this is the feed row.
  broadcast: inAppOnly,

  session_soon: groupPushEmail,
  room_live: groupPush,
  target_reminder: groupPushEmail,
  streak_risk: { ...push, dedupe: true },
  // Being tagged always reaches you, muted group or not.
  mention: { ...push, dedupe: true },
  group_post: groupPushEmail,
  book_changed: groupPush,
  target_set: groupPush,
  milestone: { ...push, dedupe: true },
  // Not a member yet, so no group mute; one per group and reader a day.
  group_invite: { ...push, dedupe: true },
  // The passage of the day, to every reader; no group to mute. One a day,
  // so replacing the day's passage doesn't push again.
  passage: { ...push, dedupe: true },
};

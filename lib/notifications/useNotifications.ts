"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { useIsAuthenticated } from "@/lib/auth/useIsAuthenticated";
import { notificationKeys } from "@/lib/notifications/queryKeys";
import type { NotificationKind } from "@/lib/notifications/types";
import type { Avatar } from "@/lib/avatar/avatar";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  url: string;
  read: boolean;
  createdAt: string;
  /** The reader who triggered it — their *current* pseudonym, resolved per
   * request (null for broadcasts/digests, and for rows written before
   * actor_reader_id existed). */
  actorPseudonym: string | null;
  actorAvatar: Avatar | null;
  /** The reacted-to/replied-to text, frozen at notify time — quoted under
   * the row. Null for voice notes and non-post notifications. */
  snippet: string | null;
};

type NotificationsPage = { items: NotificationItem[]; nextCursor: string | null; unreadCount: number };

/** `GET /api/notifications` — first page for the /notifications feed page.
 * Older pages are fetched on demand by NotificationsView's "Load more"
 * button (apiFetch directly, same pattern as this hook's queryFn) rather
 * than a second hook, since only the first page needs to stay reactive to
 * cache invalidation (e.g. after marking everything read). */
export function useNotifications() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: notificationKeys.list,
    queryFn: () => apiFetch<NotificationsPage>("/notifications"),
    enabled: isAuthenticated,
  });
}

/** Polled by the header bell (NotificationsMenu.tsx) for its badge — a
 * plain count, not the full feed, so the poll stays cheap. 30s matches the
 * "good enough, not real-time" bar for this app's other periodic reads. */
export function useUnreadNotificationsCount() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: () => apiFetch<{ count: number }>("/auth/me/notifications-count").then((r) => r.count),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });
}

/** Keeps the app icon's badge (Badging API, installed PWAs) on the unread
 * count while the app is open: down as notifications are read, cleared on
 * sign-out. A push sets it while the app is closed (sw.js). Mounted once,
 * in AppShell. */
export function useAppBadge() {
  const isAuthenticated = useIsAuthenticated();
  const { data: count = 0 } = useUnreadNotificationsCount();
  const unread = isAuthenticated ? count : 0;
  useEffect(() => {
    if (!("setAppBadge" in navigator)) return;
    void (unread > 0 ? navigator.setAppBadge(unread) : navigator.clearAppBadge()).catch(() => {});
  }, [unread]);
}

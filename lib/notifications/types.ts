// Shared between server (notify.ts, API routes) and client (useNotifications.ts)
// — kept in its own file so client components importing this type never pull
// in notify.ts's server-only imports (getSupabaseAdminClient, web-push).
// Mirrors notifications_kind_check (migrations/20261203_book_request_kind.sql).
export type NotificationKind =
  | "reaction"
  | "reply"
  | "broadcast"
  | "digest"
  | "material_reaction"
  // Study group (studygroup-spec.md §7).
  | "session_soon"
  | "session_scheduled"
  | "room_live"
  | "target_reminder"
  | "streak_risk"
  | "goal_reminder"
  | "mention"
  | "group_post"
  | "book_changed"
  | "target_set"
  | "milestone"
  | "group_invite"
  // Rooms (rooms-spec §5.5).
  | "passage"
  // A reader's book request was added (/admin/library/suggestions).
  | "book_request";

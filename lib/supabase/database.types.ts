// Hand-written to match models-spec.md exactly — there's no `supabase gen types`
// step in this project (see plan.md's Phase 0 note on skipping the CLI entirely),
// so this is the one place that has to be kept in sync by hand whenever the schema
// changes. Passed as createClient<Database>()'s generic (lib/supabase/adminClient.ts)
// so every table read/write across the app is checked against real column names
// instead of silently collapsing to `never` (supabase-js's default-generic quirk).
//
// jsonb columns are typed as `Json` here, same as `supabase gen types` would do —
// callers cast to the real app-level shape (AnnotationRange[], TocSection[], etc.,
// both defined in api-spec.md) on read, and rely on structural compatibility with
// `Json` on write. Nothing here should leak into JSON API responses verbatim; that
// snake_case -> camelCase translation is the route handler's job (api-spec.md's
// Conventions).
import type { NotificationKind } from "@/lib/notifications/types";
import type { RoomKind } from "@/lib/rooms/types";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type GroupEventKind = "joined" | "target_set" | "book_current" | "book_added" | "session_scheduled" | "room_started";

type Timestamps = { created_at: string; updated_at: string };

export type Database = {
  public: {
    Tables: {
      readers: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          pseudonym: string;
          city: string | null;
          country: string | null;
          interests: Json;
          survey_read_material_ids: Json;
          age_range: "13_17" | "18_24" | "25_34" | "35_44" | "45_54" | "55_64" | "65_plus" | null;
          gender_identity: string | null;
          onboarding_status: "pending_survey" | "pending_welcome" | "active";
          avatar_color: string | null;
          avatar_url: string | null;
          email_announcements: boolean;
          upload_approved: boolean;
          /** IANA zone synced from the device — migrations/20261017_reader_timezone.sql. */
          timezone: string | null;
          /** The Ominira account (migrations/20261106_daily_passages.sql). */
          official: boolean;
          joined_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          pseudonym: string;
          city?: string | null;
          country?: string | null;
          interests?: Json;
          survey_read_material_ids?: Json;
          age_range?: "13_17" | "18_24" | "25_34" | "35_44" | "45_54" | "55_64" | "65_plus" | null;
          gender_identity?: string | null;
          onboarding_status?: "pending_survey" | "pending_welcome" | "active";
          avatar_color?: string | null;
          avatar_url?: string | null;
          email_announcements?: boolean;
          upload_approved?: boolean;
          timezone?: string | null;
          official?: boolean;
          joined_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["readers"]["Insert"]>;
        Relationships: [];
      };
      pending_materials: {
        Row: {
          id: string;
          submission_type: "upload" | "suggestion" | "external_url";
          title: string;
          author: string | null;
          reader_id: string | null;
          source_url: string | null;
          storage_path: string | null;
          original_filename: string | null;
          mime_type: string | null;
          file_size_bytes: number | null;
          status: "pending" | "approved";
          material_id: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          submission_type: "upload" | "suggestion" | "external_url";
          title: string;
          author?: string | null;
          reader_id?: string | null;
          source_url?: string | null;
          storage_path?: string | null;
          original_filename?: string | null;
          mime_type?: string | null;
          file_size_bytes?: number | null;
          status?: "pending" | "approved";
          material_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pending_materials"]["Insert"]>;
        Relationships: [];
      };
      materials: {
        Row: {
          id: string;
          slug: string;
          material_type: string;
          title: string;
          author: string;
          description: string | null;
          cover_url: string | null;
          thumbnail_url: string | null;
          /** { googleBooksId, isbn, coverUrl, thumbnailUrl, description } — see
           * scripts/generate-material-google-metadata.ts and lib/materials/providerMeta.ts. */
          google_meta_data: Json | null;
          /** { coverUrl, thumbnailUrl, description } — see
           * scripts/generate-material-openlibrary-metadata.ts. */
          openlibrary_meta_data: Json | null;
          /** Which of cover_url/thumbnail_url ("own"), openlibrary_meta_data, or
           * google_meta_data resolveBookCoverSrc/resolveBookThumbnailSrc
           * (lib/materials/image.ts) tries first — see migrations/20260829_materials_cover_source.sql. */
          cover_source: "own" | "openlibrary" | "google";
          language: string | null;
          published_year: number | null;
          page_count_estimate: number | null;
          categories: Json;
          narrator_count: number;
          toc: Json;
          toc_titles: string;
          spine: Json;
          json_storage_path: string | null;
          /** Readability-extracted article HTML for a `material_type: "webpage"`
           * row — see migrations/20260929_article_html_storage_path.sql. */
          article_html_storage_path: string | null;
          status: "draft" | "published";
          uploaded_by: string | null;
          visibility: "personal" | "public";
          source_url: string | null;
          search_vector: string | null;
          /** Appreciation ("heart") count from the shared public.reactions
           * table (target_type = 'material') — see
           * migrations/20260930_material_reactions.sql. Maintained by a
           * DB trigger, same pattern as posts.reaction_count. */
          reaction_count: number;
          /** Bytes of the primary stored object (source file, else parsed JSON,
           * else article HTML) — migrations/20261005_admin_dashboard.sql. */
          file_size_bytes: number | null;
        } & Timestamps;
        Insert: {
          id?: string;
          slug: string;
          material_type?: string;
          title: string;
          author: string;
          description?: string | null;
          cover_url?: string | null;
          thumbnail_url?: string | null;
          google_meta_data?: Json | null;
          openlibrary_meta_data?: Json | null;
          cover_source?: "own" | "openlibrary" | "google";
          language?: string | null;
          published_year?: number | null;
          page_count_estimate?: number | null;
          categories?: Json;
          narrator_count?: number;
          toc?: Json;
          toc_titles?: string;
          spine?: Json;
          json_storage_path?: string | null;
          article_html_storage_path?: string | null;
          status?: "draft" | "published";
          uploaded_by?: string | null;
          visibility?: "personal" | "public";
          source_url?: string | null;
          reaction_count?: number;
          file_size_bytes?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["materials"]["Insert"]>;
        Relationships: [];
      };
      highlights: {
        Row: {
          id: string;
          reader_id: string;
          material_id: string;
          ranges: Json;
          visibility: "public" | "private";
        } & Timestamps;
        Insert: {
          id?: string;
          reader_id: string;
          material_id: string;
          ranges: Json;
          visibility?: "public" | "private";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["highlights"]["Insert"]>;
        Relationships: [];
      };
      // One row per (reader, material) — replaces readers.current_reading (a jsonb
      // map) as of migrations/20260831_reader_activities.sql. "activities", not
      // "reading_positions": `mode` means this covers listening too.
      //
      // `locator` is format-agnostic (migrations/20261001_reader_activities_locator
      // .sql): typed `Json` here, same as every other jsonb column, and narrowed to
      // the real `Locator` union by lib/reader/locator.ts's own `isLocator` at the
      // read boundary rather than cast.
      reader_activities: {
        Row: {
          reader_id: string;
          material_id: string;
          locator: Json;
          mode: "read" | "listen";
          audio_time_ms: number | null;
          progress_percent: number;
          // Explicit completion — never inferable from progress_percent (see
          // migrations/20261002_reader_activities_finished_at.sql) and never written by the
          // position-save path.
          finished_at: string | null;
          updated_at: string;
        };
        Insert: {
          reader_id: string;
          material_id: string;
          locator: Json;
          mode: "read" | "listen";
          audio_time_ms?: number | null;
          progress_percent: number;
          finished_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reader_activities"]["Insert"]>;
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          reader_id: string;
          material_id: string;
          parent_id: string | null;
          replying_to_id: string | null;
          ranges: Json;
          content_kind: "text" | "voice";
          content_text: string | null;
          content_audio_url: string | null;
          content_audio_duration_ms: number | null;
          visibility: "public" | "private";
          reaction_count: number;
        } & Timestamps;
        Insert: {
          id?: string;
          reader_id: string;
          material_id: string;
          parent_id?: string | null;
          replying_to_id?: string | null;
          ranges: Json;
          content_kind: "text" | "voice";
          content_text?: string | null;
          content_audio_url?: string | null;
          content_audio_duration_ms?: number | null;
          visibility?: "public" | "private";
          reaction_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notes"]["Insert"]>;
        Relationships: [];
      };
      note_reactions: {
        Row: { note_id: string; reader_id: string; created_at: string };
        Insert: { note_id: string; reader_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["note_reactions"]["Insert"]>;
        Relationships: [];
      };
      categories: {
        Row: { name: string; position: number };
        Insert: { name: string; position: number };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      topics: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          cover_url: string | null;
          source: "curated" | "user_created" | "legacy_migration";
          created_by: string | null;
          status: "active" | "pending" | "archived";
          follower_count: number;
          post_count: number;
        } & Timestamps;
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          cover_url?: string | null;
          source?: "curated" | "user_created" | "legacy_migration";
          created_by?: string | null;
          status?: "active" | "pending" | "archived";
          follower_count?: number;
          post_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["topics"]["Insert"]>;
        Relationships: [];
      };
      material_topics: {
        Row: { material_id: string; topic_id: string; created_at: string };
        Insert: { material_id: string; topic_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["material_topics"]["Insert"]>;
        Relationships: [];
      };
      // A post's topics beyond its required posts.topic_id "default" — see
      // migrations/20260927_post_topics.sql. created_at ordering is what
      // makes the first-inserted row the reader's chosen default.
      post_topics: {
        Row: { post_id: string; topic_id: string; created_at: string };
        Insert: { post_id: string; topic_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["post_topics"]["Insert"]>;
        Relationships: [];
      };
      // followable_type is constrained to 'topic' today (follows_topic_only,
      // migrations/20260919_topics_and_posts.sql) even though the column
      // already allows 'reader' for a future member-to-member follow graph.
      follows: {
        Row: {
          id: string;
          follower_id: string;
          followable_type: "topic" | "reader";
          followable_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_id: string;
          followable_type: "topic" | "reader";
          followable_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["follows"]["Insert"]>;
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          reader_id: string;
          // Optional since migrations/20261024_group_notes.sql: new posts write none.
          topic_id: string | null;
          material_id: string | null;
          ranges: Json | null;
          parent_id: string | null;
          replying_to_id: string | null;
          thread_type: "note" | "discussion";
          kind: "citation" | "text" | "link" | "video" | "book_share" | "voice";
          content: Json;
          visibility: "public" | "private";
          reaction_count: number;
          reply_count: number;
          /** Posted from this group's composer (studygroup-spec.md §4.5). */
          group_id: string | null;
          /** "Whole circle": a private post this group's members can read. */
          mentions_group_id: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          reader_id: string;
          topic_id?: string | null;
          material_id?: string | null;
          ranges?: Json | null;
          parent_id?: string | null;
          replying_to_id?: string | null;
          thread_type?: "note" | "discussion";
          kind: "citation" | "text" | "link" | "video" | "book_share" | "voice";
          content: Json;
          visibility?: "public" | "private";
          reaction_count?: number;
          reply_count?: number;
          group_id?: string | null;
          mentions_group_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
        Relationships: [];
      };
      // Who a post tags (migrations/20261024_group_notes.sql): each can read
      // it even when private, and gets `mention`.
      post_mentions: {
        Row: { post_id: string; reader_id: string; created_at: string };
        Insert: { post_id: string; reader_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["post_mentions"]["Insert"]>;
        Relationships: [];
      };
      reactions: {
        Row: { target_type: "post" | "material"; target_id: string; reader_id: string; created_at: string };
        Insert: {
          target_type: "post" | "material";
          target_id: string;
          reader_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reactions"]["Insert"]>;
        Relationships: [];
      };
      /** migrations/20261003_bookmarks.sql — reactions' private twin (same
       * polymorphic key shape). No Update: a bookmark has no mutable
       * column, it exists or it doesn't. */
      bookmarks: {
        Row: { target_type: "post" | "material"; target_id: string; reader_id: string; created_at: string };
        Insert: {
          target_type: "post" | "material";
          target_id: string;
          reader_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookmarks"]["Insert"]>;
        Relationships: [];
      };
      /** migrations/20261004_reader_active_days.sql — one row per reader per
       * UTC day they were active (`day` is a `date`, "YYYY-MM-DD"). */
      reader_active_days: {
        Row: { day: string; reader_id: string; read: boolean };
        Insert: { day: string; reader_id: string; read?: boolean };
        Update: Partial<Database["public"]["Tables"]["reader_active_days"]["Insert"]>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          reader_id: string | null;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          reader_id?: string | null;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          last_seen_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Insert"]>;
        Relationships: [];
      };
      push_broadcasts: {
        Row: {
          id: string;
          title: string;
          body: string;
          url: string;
          recipient_count: number;
          failure_count: number;
          channels: ("push" | "email")[];
          email_recipient_count: number;
          email_failure_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body: string;
          url: string;
          recipient_count: number;
          failure_count?: number;
          channels?: ("push" | "email")[];
          email_recipient_count?: number;
          email_failure_count?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["push_broadcasts"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          reader_id: string;
          kind: NotificationKind;
          title: string;
          body: string;
          url: string;
          read_at: string | null;
          // topic_id/digest_count/latest_post_id: migrations/20260919_topics_and_posts.sql.
          // digest_count/latest_post_id only meaningful for kind = 'digest'.
          topic_id: string | null;
          digest_count: number;
          latest_post_id: string | null;
          // actor_reader_id/snippet: migrations/20260919_notifications_actor_snippet.sql.
          // The actor is a live FK (its pseudonym is joined at read time);
          // snippet is the frozen text the notification was about.
          actor_reader_id: string | null;
          snippet: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reader_id: string;
          kind: NotificationKind;
          title: string;
          body: string;
          url: string;
          read_at?: string | null;
          topic_id?: string | null;
          digest_count?: number;
          latest_post_id?: string | null;
          actor_reader_id?: string | null;
          snippet?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
      /** Dedupe claims — migrations/20261019_notification_deliveries.sql. */
      notification_deliveries: {
        Row: { kind: NotificationKind; ref: string; reader_id: string; sent_on: string };
        Insert: { kind: NotificationKind; ref: string; reader_id: string; sent_on?: string };
        Update: Partial<Database["public"]["Tables"]["notification_deliveries"]["Insert"]>;
        Relationships: [];
      };
      /** Reading Room — migrations/20261011_rooms.sql … 20261015_room_membership.sql.
       * Written only through the room SQL functions below (start_room,
       * join_room, leave_room, end_room), never inserted directly. */
      rooms: {
        Row: {
          id: string;
          group_id: string | null;
          session_id: string | null;
          material_id: string;
          /** Null shows as "<book title> reading room" (lib/room/title.ts). */
          title: string | null;
          started_by: string;
          status: "live" | "ended";
          started_at: string;
          ended_at: string | null;
          full_seconds: number;
          full_since: string | null;
          max_members: number;
        };
        Insert: {
          id?: string;
          group_id?: string | null;
          session_id?: string | null;
          material_id: string;
          title?: string | null;
          started_by: string;
          status?: "live" | "ended";
          started_at?: string;
          ended_at?: string | null;
          full_seconds?: number;
          full_since?: string | null;
          max_members?: number;
        };
        Update: Partial<Database["public"]["Tables"]["rooms"]["Insert"]>;
        Relationships: [];
      };
      room_members: {
        Row: { room_id: string; reader_id: string; joined_at: string; left_at: string | null; last_seen_at: string };
        Insert: { room_id: string; reader_id: string; joined_at?: string; left_at?: string | null; last_seen_at?: string };
        Update: Partial<Database["public"]["Tables"]["room_members"]["Insert"]>;
        Relationships: [];
      };
      /** Study groups (migrations/20261021_groups.sql). Readable by everyone;
       * written by the API routes' admin client. */
      groups: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string;
          /** IANA zone; weekly sessions recur in it. */
          timezone: string;
          pinned_post_id: string | null;
          /** This week's target is pinned to the room's strip. */
          pin_target: boolean;
          /** A session pinned to the strip: its series_id, else its id. */
          pinned_session_id: string | null;
          /** Invite only: unlisted, joined by a moderator's invite. */
          is_private: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string;
          timezone: string;
          pinned_post_id?: string | null;
          pin_target?: boolean;
          pinned_session_id?: string | null;
          is_private?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["groups"]["Insert"]>;
        Relationships: [];
      };
      /** Role changes and leaving go through set_group_role / leave_group
       * (last-moderator rule), never a direct update or delete. */
      group_members: {
        Row: { group_id: string; reader_id: string; role: "moderator" | "member"; muted: boolean; joined_at: string };
        Insert: { group_id: string; reader_id: string; role?: "moderator" | "member"; muted?: boolean; joined_at?: string };
        Update: Partial<Database["public"]["Tables"]["group_members"]["Insert"]>;
        Relationships: [];
      };
      /** migrations/20261023_group_books.sql. Adding and "Read this now" go
       * through add_group_book / set_current_group_book (one current book);
       * position (20261031_group_books_position.sql) orders Up next. */
      group_books: {
        Row: {
          group_id: string;
          material_id: string;
          status: "current" | "next" | "done";
          starts_on: string | null;
          ends_on: string | null;
          finished_on: string | null;
          added_by: string | null;
          created_at: string;
          position: number | null;
        };
        Insert: {
          group_id: string;
          material_id: string;
          status?: "current" | "next" | "done";
          starts_on?: string | null;
          ends_on?: string | null;
          finished_on?: string | null;
          added_by?: string | null;
          created_at?: string;
          position?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["group_books"]["Insert"]>;
        Relationships: [];
      };
      /** This week's target (migrations/20261025_group_targets.sql): one
       * active (superseded_at null) per group, set through set_group_target. */
      group_targets: {
        Row: {
          id: string;
          group_id: string;
          material_id: string;
          start_pct: number;
          end_pct: number;
          end_label: string;
          end_chapter: number | null;
          chapter_count: number | null;
          starts_on: string;
          due_on: string;
          created_by: string | null;
          created_at: string;
          superseded_at: string | null;
        };
        Insert: {
          id?: string;
          group_id: string;
          material_id: string;
          start_pct: number;
          end_pct: number;
          end_label: string;
          end_chapter?: number | null;
          chapter_count?: number | null;
          starts_on: string;
          due_on: string;
          created_by?: string | null;
          created_at?: string;
          superseded_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["group_targets"]["Insert"]>;
        Relationships: [];
      };
      /** Sessions (migrations/20261026_group_sessions.sql): one row per
       * occurrence; a weekly series links its rows by series_id. Added
       * through add_group_session. */
      group_sessions: {
        Row: {
          id: string;
          group_id: string;
          series_id: string | null;
          topic: string;
          material_id: string | null;
          section_label: string | null;
          starts_at: string;
          repeat: "once" | "weekly";
          number: number;
          created_by: string | null;
          created_at: string;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          group_id: string;
          series_id?: string | null;
          topic: string;
          material_id?: string | null;
          section_label?: string | null;
          starts_at: string;
          repeat: "once" | "weekly";
          number: number;
          created_by?: string | null;
          created_at?: string;
          cancelled_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["group_sessions"]["Insert"]>;
        Relationships: [];
      };
      /** Who came to a session: written by join_room on a session's room. */
      session_attendance: {
        Row: { session_id: string; reader_id: string; joined_at: string };
        Insert: { session_id: string; reader_id: string; joined_at?: string };
        Update: Partial<Database["public"]["Tables"]["session_attendance"]["Insert"]>;
        Relationships: [];
      };
      /** Remind me off, for a series (its series_id) or one session (its id). */
      session_reminder_optouts: {
        Row: { series_or_session_id: string; reader_id: string; created_at: string };
        Insert: { series_or_session_id: string; reader_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["session_reminder_optouts"]["Insert"]>;
        Relationships: [];
      };
      /** migrations/20261029_streaks.sql: reader-local reading days. */
      reader_reading_days: {
        Row: { reader_id: string; day: string; restored: boolean };
        Insert: { reader_id: string; day: string; restored?: boolean };
        Update: Partial<Database["public"]["Tables"]["reader_reading_days"]["Insert"]>;
        Relationships: [];
      };
      /** The run ending at last_day (lib/streaks/rules.ts `Streak`). */
      reader_streaks: {
        Row: {
          reader_id: string;
          current: number;
          best: number;
          last_day: string | null;
          previous: number;
          restore_month: string | null;
          declined_on: string | null;
          /** The reader's daily goal; null is the default (GOAL.fallback). */
          daily_goal_minutes: number | null;
          updated_at: string;
        };
        Insert: {
          reader_id: string;
          current?: number;
          best?: number;
          last_day?: string | null;
          previous?: number;
          restore_month?: string | null;
          declined_on?: string | null;
          daily_goal_minutes?: number | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reader_streaks"]["Insert"]>;
        Relationships: [];
      };
      /** migrations/20261107_reading_time.sql (rooms-spec §5.7): seconds read
       * per local day, credited by record_reading_time. */
      reader_reading_time: {
        Row: { reader_id: string; day: string; seconds: number; last_at: string; goal_minutes: number | null };
        Insert: { reader_id: string; day: string; seconds?: number; last_at: string; goal_minutes?: number | null };
        Update: Partial<Database["public"]["Tables"]["reader_reading_time"]["Insert"]>;
        Relationships: [];
      };
      /** migrations/20261111_reading_history.sql: each book's seconds per
       * local day, credited with the day's total by record_reading_time. */
      reader_book_time: {
        Row: { reader_id: string; day: string; material_id: string; seconds: number };
        Insert: { reader_id: string; day: string; material_id: string; seconds?: number };
        Update: Partial<Database["public"]["Tables"]["reader_book_time"]["Insert"]>;
        Relationships: [];
      };
      reader_milestones: {
        Row: { reader_id: string; kind: "streak"; value: number; reached_on: string; reached_at: string };
        Insert: { reader_id: string; kind: "streak"; value: number; reached_on: string; reached_at?: string };
        Update: Partial<Database["public"]["Tables"]["reader_milestones"]["Insert"]>;
        Relationships: [];
      };
      /** migrations/20261030_group_milestones.sql: feed items, copy frozen. */
      group_milestones: {
        Row: {
          id: string;
          group_id: string;
          kind: "session_held" | "book_finished" | "target_reached";
          ref: string;
          material_id: string | null;
          title: string;
          detail: string | null;
          reached: number | null;
          total: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          kind: "session_held" | "book_finished" | "target_reached";
          ref: string;
          material_id?: string | null;
          title: string;
          detail?: string | null;
          reached?: number | null;
          total?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["group_milestones"]["Insert"]>;
        Relationships: [];
      };
      /** migrations/20261106_daily_passages.sql (rooms-spec §5.5): the day's
       * passage, a note in the group, and its question. */
      daily_passages: {
        Row: { day: string; post_id: string; question: string; set_by: string | null; created_at: string };
        Insert: { day: string; post_id: string; question: string; set_by?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["daily_passages"]["Insert"]>;
        Relationships: [];
      };
      /** migrations/20261119_passage_sets.sql (passage-spec §1): what an
       * editor's AI sends in, for /admin/passage. */
      passage_sets: {
        Row: { id: string; title: string; note: string; created_at: string };
        Insert: { id?: string; title: string; note?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["passage_sets"]["Insert"]>;
        Relationships: [];
      };
      /** `ranges` and `picked_ranges` are AnnotationRange[]; `context` is
       * { passageId, text }[]. */
      passage_quotes: {
        Row: {
          id: string;
          set_id: string;
          position: number;
          material_id: string;
          ranges: Json;
          picked_ranges: Json;
          context: Json;
          why: string;
          question: string;
          status: "new" | "used" | "dismissed";
          post_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          set_id: string;
          position: number;
          material_id: string;
          ranges: Json;
          picked_ranges: Json;
          context: Json;
          why?: string;
          question?: string;
          status?: "new" | "used" | "dismissed";
          post_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["passage_quotes"]["Insert"]>;
        Relationships: [];
      };
      /** migrations/20261105_room_reads.sql (rooms-spec §5.2): how far a
       * reader has read a room; `room_id` is a group's or a material's. */
      room_reads: {
        Row: { reader_id: string; room_kind: RoomKind; room_id: string; last_read_at: string };
        Insert: { reader_id: string; room_kind: RoomKind; room_id: string; last_read_at?: string };
        Update: Partial<Database["public"]["Tables"]["room_reads"]["Insert"]>;
        Relationships: [];
      };
      /** migrations/20261104_group_events.sql (rooms-spec §5.1): the group
       * stream's system lines, written by the SQL functions only. `payload`
       * is the line's frozen words (GroupEventPayload in lib/rooms/timeline). */
      group_events: {
        Row: {
          id: string;
          group_id: string;
          kind: GroupEventKind;
          actor_id: string | null;
          ref: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    // Required by supabase-js's GenericSchema shape even with no views —
    // omitting it collapses the whole schema (and every table's row type) to
    // `never` rather than erroring loudly, which is its own trap.
    Views: Record<string, never>;
    Functions: {
      /** migrations/20261005_admin_dashboard.sql — shape in lib/metrics/dashboard.ts. */
      admin_dashboard_metrics: { Args: Record<string, never>; Returns: Json };
      /** migrations/20261118_admin_weekly_dashboard.sql — shape in lib/metrics/dashboard.ts. */
      admin_weekly_metrics: { Args: { week_start: string }; Returns: Json };
      admin_weekly_readers: { Args: { week_start: string }; Returns: Json };
      /** Reading Room (migrations/20261012…20261015). Null when the book can't host a room. */
      /** A group room needs `grp` (moderators only) and may carry its `session`. */
      start_room: {
        Args: { material: string; reader: string; room_title: string | null; grp?: string | null; session?: string | null };
        Returns: string | null;
      };
      join_room: {
        Args: { room: string; reader: string };
        Returns: "joined" | "not_found" | "ended" | "forbidden" | "full";
      };
      leave_room: { Args: { room: string; reader: string }; Returns: undefined };
      end_room: { Args: { room: string }; Returns: boolean };
      room_moderator_ids: { Args: { room: string }; Returns: string[] };
      /** Members in the room now (left_at null, seen within 75 s). */
      room_active_count: { Args: { room: string }; Returns: number };
      is_room_moderator: { Args: { room: string; reader: string }; Returns: boolean };
      can_join_room: { Args: { room: string; reader: string }; Returns: boolean };
      /** Called by the reader in the room (authenticated). False: aged out or ended, rejoin. */
      room_heartbeat: { Args: { room: string }; Returns: boolean };
      /** Study groups (migrations/20261021_groups.sql). */
      is_group_member: { Args: { grp: string; reader: string }; Returns: boolean };
      is_group_moderator: { Args: { grp: string; reader: string }; Returns: boolean };
      /** migrations/20261126_unread_notification_counts.sql — the app icon's badge, per push. */
      unread_notification_counts: { Args: { readers: string[] }; Returns: { reader_id: string; unread: number }[] };
      /** migrations/20261024_group_notes.sql: "Bring in", most shared books first. */
      reading_comrades: { Args: { reader: string; max_rows?: number }; Returns: { reader_id: string; shared: number }[] };
      /** migrations/20261101_mention_comrades.sql — the tag picker before a name is typed. */
      mention_comrades: { Args: { reader: string; max_rows?: number }; Returns: { reader_id: string; score: number }[] };
      /** migrations/20261122_book_rooms_replies.sql — Home's rooms column. */
      book_rooms: {
        Args: { reader: string | null };
        Returns: { material_id: string; author: string; kind: "citation" | "text" | "link" | "video" | "book_share" | "voice"; content: Json; created_at: string; reply: boolean; unread: number }[];
      };
      /** migrations/20261110_book_rooms.sql — readers per book, the day's and now. */
      book_readers: { Args: { day_since: string; now_since: string; reader: string | null }; Returns: { material_id: string; day: number; now: number }[] };
      leave_group: { Args: { grp: string; reader: string }; Returns: "left" | "not_member" | "last_moderator" };
      set_group_role: {
        Args: { grp: string; reader: string; new_role: "moderator" | "member" };
        Returns: "updated" | "not_member" | "last_moderator";
      };
      add_group_book: { Args: { grp: string; material: string; reader: string }; Returns: "current" | "next" | "exists" };
      set_current_group_book: { Args: { grp: string; material: string; reader?: string | null }; Returns: boolean };
      reorder_group_books: { Args: { grp: string; materials: string[] }; Returns: undefined };
      /** migrations/20261111_reading_history.sql: one reading-position save, and its book. */
      record_reading_time: {
        Args: { reader: string; material: string; today: string; at: string; idle_seconds: number };
        Returns: { day_seconds: number; day_goal: number };
      };
      /** A reader's seconds per book per month (`month` is its first day). */
      reading_history_day_books: {
        Args: { reader: string; from_day: string; to_day: string };
        Returns: { day: string; material_ids: string[] }[];
      };
      collective_reading_seconds: { Args: { today: string }; Returns: number };
      /** Where a target set `today` starts (an edit keeps the running one's start). */
      group_target_start: {
        Args: { grp: string; material: string; today: string };
        Returns: { from_pct: number; from_day: string }[];
      };
      /** The new target's id, or 'below_start' when it ends at or before where it starts. */
      set_group_target: {
        Args: {
          grp: string;
          material: string;
          new_end_pct: number;
          new_end_label: string;
          new_end_chapter: number | null;
          new_chapter_count: number | null;
          today: string;
          new_due_on: string;
          reader: string;
        };
        Returns: string;
      };
      /** The new session's id; null when that occurrence of the series exists. */
      add_group_session: {
        Args: {
          grp: string;
          series: string | null;
          new_topic: string;
          material: string | null;
          new_section_label: string | null;
          new_starts_at: string;
          new_repeat: "once" | "weekly";
          reader: string | null;
        };
        Returns: string | null;
      };
      /** The latest row of every running weekly series (of one group, or all). */
      group_session_series: {
        Args: { grp?: string | null };
        Returns: Database["public"]["Tables"]["group_sessions"]["Row"][];
      };
    };
  };
};

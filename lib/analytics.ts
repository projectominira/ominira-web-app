import type { PostHog } from "posthog-js";

/** Set by AdminShell once the PIN is passed: this browser belongs to an admin.
 * (Value kept from the Vercel Analytics days so existing admin browsers stay out.) */
export const ANALYTICS_OPT_OUT_KEY = "va-disable";

/** Every custom event, so names stay consistent in PostHog. */
export type AnalyticsEvent =
  | "signed_up"
  | "onboarding_completed" // the welcome tap; `push` is the browser's notification state then
  | "push_asked" // our sheet shown; `where`
  | "push_answered" // our ask answered; `where`, `answer` (allow | not_now)
  | "push_permission" // the browser's dialog answered; `where`, `result` (granted | denied | default)
  | "push_save_failed" // granted, but the device's subscription didn't save; `where`
  | "note_shared"
  | "room_started"
  | "room_joined";

let client: Promise<PostHog | null> | null = null;

function optedOut(): boolean {
  try {
    return Boolean(localStorage.getItem(ANALYTICS_OPT_OUT_KEY));
  } catch {
    return false;
  }
}

/** Loads PostHog once, production only. Cookieless (no banner needed); events go
 * through /ingest on our own domain (deploy/Caddyfile) so ad blockers don't drop them. */
export function startAnalytics(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (client || !key || process.env.NODE_ENV !== "production" || optedOut()) return;
  client = import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      defaults: "2025-05-24", // pageviews on client-side navigation
      cookieless_mode: "always",
      autocapture: false,
      disable_session_recording: true,
      before_send: (event) => {
        if (!event || optedOut()) return null;
        const url = event.properties?.$current_url;
        if (typeof url === "string" && new URL(url).pathname.startsWith("/admin")) return null;
        return event;
      },
    });
    return posthog;
  }).catch(() => null);
}

export function track(event: AnalyticsEvent, properties?: Record<string, string | number | boolean | null>): void {
  void client?.then((posthog) => posthog?.capture(event, properties));
}

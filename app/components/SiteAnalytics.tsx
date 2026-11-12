"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/react";

/** Set by AdminShell once the PIN is passed: this browser belongs to an admin. */
export const ANALYTICS_OPT_OUT_KEY = "va-disable";

/** Admin pages, and any browser that has opened /admin, never reach Vercel Analytics. */
function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  if (new URL(event.url).pathname.startsWith("/admin")) return null;
  try {
    if (localStorage.getItem(ANALYTICS_OPT_OUT_KEY)) return null;
  } catch {}
  return event;
}

export default function SiteAnalytics() {
  // `mode` is explicit so a local dev run never reports as production even if
  // NODE_ENV gets overridden by tooling; other modes just console-log events.
  return (
    <Analytics
      mode={process.env.NODE_ENV === "production" ? "production" : "development"}
      beforeSend={beforeSend}
    />
  );
}

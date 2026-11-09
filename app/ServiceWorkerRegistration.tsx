"use client";

import { useEffect } from "react";
import { resyncPushSubscription } from "@/lib/push/useWebPush";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | null = null;
    navigator.serviceWorker
      // The build id makes each deploy a new worker URL, so it installs (and
      // refreshes the shell cache) on the first load after a push — sw.js.
      .register(`/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID}`)
      .then((reg) => {
        registration = reg;
        // Proactively check for a newer sw.js
        // instead of relying solely on the browser's navigation-triggered check,
        // which can be delayed by HTTP caching of sw.js itself.
        reg.update().catch(() => {});
        resyncPushSubscription(reg).catch(() => {});
      })
      .catch(() => {});

    const onVisibility = () => {
      if (document.visibilityState === "visible") registration?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return null;
}

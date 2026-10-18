"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSessionStore } from "@/stores/session-store";
import { ensureFreshSession } from "@/lib/api/client";
import { configureDebouncedOnlineManager } from "@/lib/pwa/onlineManager";
import { useTimeZoneSync } from "@/lib/time/useTimeZoneSync";

// One QueryClient per browser tab, instantiated inside useState (not at
// module scope) so it's created exactly once per mount and never recreated
// on re-render — the standard App Router pattern, since a module-scope
// singleton would be shared (and leak query cache) across requests on the
// server.
export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());

  // Debounces the online/offline signal every query below reacts to (see
  // that module's own doc comment) — must run client-side only, hence a
  // useEffect rather than module scope, since this component's module still
  // executes during the server render pass. Called once, here, since this
  // provider is itself mounted exactly once at the app root.
  useEffect(() => {
    configureDebouncedOnlineManager();
  }, []);

  // session-store skips automatic persist hydration (see its own doc
  // comment) so the server and the client's first paint agree — rehydrated
  // once here, at the root, rather than per-component the way every other
  // read-only consumer (useIsAuthenticated) would otherwise have to.
  //
  // Once that's done, proactively refresh the access token if it's already
  // stale — a reader reopening the app after it's sat untouched for a
  // while (hours, days) would otherwise render as logged out for the brief
  // window before any component's first API call happened to trigger
  // apiFetch's own lazy refresh (see lib/api/client.ts's ensureFreshSession).
  useEffect(() => {
    Promise.resolve(useSessionStore.persist.rehydrate()).then(() => {
      ensureFreshSession();
    });
  }, []);

  return (
    <QueryClientProvider client={client}>
      <TimeZoneSync />
      {children}
    </QueryClientProvider>
  );
}

function TimeZoneSync() {
  useTimeZoneSync();
  return null;
}

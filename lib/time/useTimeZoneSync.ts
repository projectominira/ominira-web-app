"use client";

import { useEffect, useRef } from "react";
import { useProfile } from "@/lib/auth/useProfile";
import { useUpdateProfile } from "@/lib/auth/useUpdateProfile";
import { deviceTimeZone } from "@/lib/time/zone";

/** Saves the device's zone to `readers.timezone` when it differs (spec
 * §9.2) — at most once per app load, so a failed write isn't retried in a
 * loop. Mounted once, at the app root. */
export function useTimeZoneSync() {
  const { data: reader } = useProfile();
  const update = useUpdateProfile();
  const tried = useRef(false);

  useEffect(() => {
    if (!reader || tried.current) return;
    tried.current = true;
    const zone = deviceTimeZone();
    if (zone && zone !== reader.timeZone) update.mutate({ timeZone: zone });
  }, [reader, update]);
}

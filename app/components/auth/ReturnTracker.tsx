"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { rememberPage } from "@/lib/auth/returnTo";

/** Mounted once in the root layout: remembers each page you open (with its
 * query), so signing in brings you back to it (lib/auth/returnTo). */
export default function ReturnTracker() {
  const pathname = usePathname();
  useEffect(() => {
    rememberPage(pathname + window.location.search);
  }, [pathname]);
  return null;
}

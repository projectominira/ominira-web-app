"use client";

import { useEffect } from "react";
import { startAnalytics } from "@/lib/analytics";

export default function SiteAnalytics() {
  useEffect(startAnalytics, []);
  return null;
}

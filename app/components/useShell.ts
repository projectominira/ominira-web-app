"use client";

import { useSyncExternalStore } from "react";

// The app's one desktop breakpoint (`--breakpoint-shell` in globals.css),
// for what CSS alone can't switch: a room's thread is a sheet below it and
// a side panel above it, one mounted component either way.
const QUERY = "(min-width: 860px)";

const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

/** The same, read once, outside render. */
export const isShell = () => window.matchMedia(QUERY).matches;

/** True at the shell breakpoint and above; false on the server. */
export function useShell(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}

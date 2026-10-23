"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { homeKey } from "@/lib/rooms/useHome";
import { useSessionStore } from "@/stores/session-store";
import type { ReadingHistory, StreakView } from "@/lib/streaks/types";

/** Restore streak or Start fresh. The streak itself comes with home's
 * summary (lib/rooms/useHome.ts). */
export function useChooseStreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (choice: "restore" | "fresh") => apiFetch<void>("/auth/me/streak", { method: "POST", json: { choice } }),
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: homeKey }), queryClient.invalidateQueries({ queryKey: ["streak"] })]),
  });
}

/** The streak alone (`GET /api/auth/me/streak`), for Shelf's window onto
 * /history; home has it in its summary. */
export function useStreak() {
  const readerId = useSessionStore((s) => s.readerId);
  return useQuery({
    queryKey: ["streak", readerId],
    queryFn: () => apiFetch<StreakView>("/auth/me/streak"),
    enabled: !!readerId,
  });
}

/** A year of the reader's reading (`GET /api/auth/me/history`); the year
 * before stays shown while the next loads. */
export function useReadingHistory(year: number) {
  const readerId = useSessionStore((s) => s.readerId);
  return useQuery({
    queryKey: ["reading-history", readerId, year],
    queryFn: () => apiFetch<ReadingHistory>(`/auth/me/history?year=${year}`),
    enabled: !!readerId,
    placeholderData: keepPreviousData,
  });
}

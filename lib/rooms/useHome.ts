"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { useIsAuthenticated } from "@/lib/auth/useIsAuthenticated";
import { useSessionStore } from "@/stores/session-store";
import type { HomeView } from "./types";

// Home on the client (rooms-spec §2 Home): the summary in one call, the
// daily goal, and "Start a room"'s books.

/** Home's summary key: `homeKey` alone matches every viewer's. */
export const homeKey = ["home"] as const;
const useHomeKey = () => [...homeKey, useSessionStore((s) => s.readerId) ?? "anon"] as const;

/** `GET /api/auth/me/home`, signed in only. */
export function useHome() {
  return useQuery({
    queryKey: useHomeKey(),
    queryFn: () => apiFetch<HomeView>("/auth/me/home"),
    enabled: useIsAuthenticated(),
    // The strip's live rooms and listener counts stay roughly current while shown.
    refetchInterval: 60_000,
  });
}

/** Adjust daily goal: `PATCH /api/auth/me/streak`, kept in the cache. */
export function useSaveGoal() {
  const queryClient = useQueryClient();
  const key = useHomeKey();
  return useMutation({
    mutationFn: (goal: number) => apiFetch<void>("/auth/me/streak", { method: "PATCH", json: { goal } }),
    onMutate: (goal) => queryClient.setQueryData<HomeView>(key, (v) => (v?.today ? { ...v, today: { ...v.today, goal } } : v)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

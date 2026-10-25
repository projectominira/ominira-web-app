"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { useSessionStore } from "@/stores/session-store";
import type { HomeView, RoomSuggestions } from "./types";

// Home on the client (rooms-spec §2 Home): the summary in one call, the
// daily goal, and "Start a room"'s books.

/** Home's summary key: `homeKey` alone matches every viewer's. */
export const homeKey = ["home"] as const;
const useHomeKey = () => [...homeKey, useSessionStore((s) => s.readerId) ?? "anon"] as const;

/** `GET /api/auth/me/home`, signed in or out. */
export function useHome() {
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  return useQuery({
    queryKey: useHomeKey(),
    queryFn: () => apiFetch<HomeView>("/auth/me/home"),
    enabled: hasHydrated,
    // The strip's live rooms and listener counts stay roughly current while shown.
    refetchInterval: 60_000,
  });
}

/** "Start a room"'s books (`GET /api/rooms/suggestions`), fetched once its
 * sheet opens and kept a minute. */
export function useRoomSuggestions() {
  return useQuery({
    queryKey: [...useHomeKey(), "room-suggestions"],
    queryFn: () => apiFetch<RoomSuggestions>("/rooms/suggestions"),
    staleTime: 60_000,
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

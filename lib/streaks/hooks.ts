"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { homeKey } from "@/lib/rooms/useHome";

/** Restore streak or Start fresh. The streak itself comes with home's
 * summary (lib/rooms/useHome.ts). */
export function useChooseStreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (choice: "restore" | "fresh") => apiFetch<void>("/auth/me/streak", { method: "POST", json: { choice } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: homeKey }),
  });
}

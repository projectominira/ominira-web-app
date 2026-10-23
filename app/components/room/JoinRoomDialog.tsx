"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import JoinRoomCard from "./JoinRoomCard";
import { apiFetch } from "@/lib/api/client";
import type { RoomInvite } from "@/lib/room/types";
import { useJoinStore } from "@/stores/join-store";
import { useReaderStore } from "@/stores/reader-store";

export const JOIN_BUTTON =
  "flex h-11 w-full cursor-pointer items-center justify-center rounded-sm border-none bg-brand-500 px-5 text-[14px] font-bold text-white no-underline transition-colors hover:bg-brand-600 disabled:cursor-default disabled:opacity-60";

/** Mounted once in the root layout: the screen behind `askToJoin`, a card
 * over a dimmed backdrop (JoinRoomCard) with Start listening. Who's in
 * loads with it (GET /api/rooms/{id}); a group's room, which that doesn't
 * serve, shows just its title. Escape and the backdrop close it. */
export default function JoinRoomDialog() {
  const pending = useJoinStore((s) => s.pending);
  const settle = useJoinStore((s) => s.settle);
  const theme = useReaderStore((s) => s.theme);
  const startRef = useRef<HTMLButtonElement>(null);
  const roomId = pending?.room.id;
  const { data: invite } = useQuery({
    queryKey: ["room-invite", roomId],
    queryFn: () => apiFetch<RoomInvite>(`/rooms/${roomId}`),
    enabled: !!roomId,
    retry: false,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!pending) return;
    startRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending, settle]);

  if (!pending) return null;
  return (
    <div data-reader-theme={theme} onClick={() => settle(false)} className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={pending.room.title}
        onClick={(e) => e.stopPropagation()}
        className="reader-menu-in w-full max-w-[540px] rounded-lg bg-[var(--reader-surface)] p-6 shadow-lg"
      >
        <JoinRoomCard title={pending.room.title} invite={invite ?? null} onClose={() => settle(false)}>
          <div className="mt-2 flex flex-col items-center gap-2">
            <p className="m-0 text-xs text-[var(--reader-text-muted)]">Your mic will be off to start</p>
            <button ref={startRef} type="button" onClick={() => settle(true)} className={JOIN_BUTTON}>
              Start listening
            </button>
          </div>
        </JoinRoomCard>
      </div>
    </div>
  );
}

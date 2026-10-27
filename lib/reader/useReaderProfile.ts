"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { useSessionStore } from "@/stores/session-store";
import type { RoomNote } from "@/lib/rooms/types";
import { useRoomHeart, useRoomReply, type NotePatcher } from "@/lib/rooms/hooks";
import { showToast } from "@/stores/toast-store";
import type { MaterialSummary } from "@/lib/api/types";
import type { Avatar } from "@/lib/avatar/avatar";

export type ReaderProfileStats = { notes: number; reading: number; reactions: number };

export type ReaderProfileCurrentlyReading = {
  material: MaterialSummary;
  /** Only populated for `isSelf` — see lib/reader/profile.ts's own doc
   * comment on why a visitor never gets someone else's exact progress. */
  progressPercent: number | null;
};

export type ReaderProfileHighlight = {
  id: string;
  material: Pick<MaterialSummary, "id" | "slug" | "title" | "author">;
  excerpt: string;
  createdAt: string;
};

/**
 * Mirrors lib/reader/profile.ts's `ReaderProfilePage` — a hand-kept client
 * copy rather than an import of that server-only module, this file's own
 * client-facing equivalent. `publicNotes` are `RoomNote`s, so a profile
 * shows notes in the same NoteBubble as a room and /note/[id].
 */
export type ReaderProfilePage = {
  reader: {
    id: string;
    pseudonym: string;
    avatar: Avatar;
    city: string | null;
    country: string | null;
    joinedAt: string;
  };
  isSelf: boolean;
  stats: ReaderProfileStats;
  currentlyReading: ReaderProfileCurrentlyReading[];
  publicNotes: RoomNote[];
  highlights: ReaderProfileHighlight[] | null;
  contributions: MaterialSummary[];
};

/** `GET /api/readers/{slug}`. Public — works signed out — but its response
 * shape depends on who's asking (`isSelf`/`highlights`), so the viewer's
 * own readerId is folded into the query key: logging in as the profile's
 * own owner in one tab (or switching accounts) while this is already
 * cached gets its own cache entry rather than silently reusing a stale
 * public-view one. Gated on session-store's own hydration (`hasHydrated`,
 * see useIsAuthenticated's doc comment) so the first real fetch already
 * knows the true viewer instead of firing once anonymously and refetching
 * a moment later. */
const profileKey = (slug: string, readerId: string | null) => ["readers", slug, readerId ?? "anon"] as const;

export function useReaderProfile(slug: string) {
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const readerId = useSessionStore((s) => s.readerId);

  return useQuery({
    queryKey: profileKey(slug, readerId),
    queryFn: () => apiFetch<ReaderProfilePage>(`/readers/${slug}`),
    enabled: Boolean(slug) && hasHydrated,
  });
}

/** React, reply and delete on a profile's notes, as a room does (the room
 * hooks over this profile's cache): at once, undone if the server says no. */
export function useProfileNoteActions(slug: string) {
  const queryClient = useQueryClient();
  const key = profileKey(slug, useSessionStore((s) => s.readerId));
  const edit = (notes: (n: RoomNote[]) => RoomNote[]) =>
    queryClient.setQueryData<ReaderProfilePage>(key, (d) => d && { ...d, publicNotes: notes(d.publicNotes) });
  const patcher: NotePatcher = (_qc, id, patch) => edit((ns) => ns.map((n) => (n.note.id === id ? patch(n) : n)));
  const heart = useRoomHeart(key, patcher);
  const reply = useRoomReply(key, patcher);
  const del = useMutation({
    mutationFn: ({ noteId }: { noteId: string; rootId: string }) => apiFetch<void>(`/community/notes/${noteId}`, { method: "DELETE" }),
    onMutate: ({ noteId, rootId }) =>
      edit((ns) =>
        noteId === rootId
          ? ns.filter((n) => n.note.id !== noteId)
          : ns.map((n) => (n.note.id === rootId ? { ...n, replies: n.replies.filter((r) => r.id !== noteId), replyCount: n.replyCount - 1 } : n))
      ),
    onError: () => showToast("Couldn’t delete it. Try again."),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  return { heart, reply, del };
}

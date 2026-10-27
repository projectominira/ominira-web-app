"use client";

import { useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient, type QueryKey } from "@tanstack/react-query";
import type { AnnotationRange, Note, NoteVisibility } from "@/lib/api/types";
import { apiFetch } from "@/lib/api/client";
import { makeTempId } from "@/lib/api/optimisticId";
import { useProfile } from "@/lib/auth/useProfile";
import { communityKeys } from "@/lib/community/queryKeys";
import { flipReaction, useCreateNote, type CreateNoteInput } from "@/lib/community/useNoteMutations";
import { groupKeys } from "@/lib/groups/queryKeys";
import { materialKeys } from "@/lib/materials/queryKeys";
import { useSessionStore } from "@/stores/session-store";
import { showToast } from "@/stores/toast-store";
import { getBookStream, getGroupStream, getReaderRoomHead } from "./api";
import { pendingNote } from "./timeline";
import type { NoteThread, RoomItem, RoomNote, RoomStreamPage } from "./types";

// A room's data on the client (rooms-spec §5): its stream a page at a time,
// your notes and replies on their way, and hearts.

type StreamCache = InfiniteData<RoomStreamPage, string | null>;

/** A room's stream, newest page first; older pages as you scroll up. */
function useStream(key: (readerId: string | null) => QueryKey, get: (cursor: string | null) => Promise<RoomStreamPage>) {
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const readerId = useSessionStore((s) => s.readerId);
  return useInfiniteQuery({
    queryKey: key(readerId),
    queryFn: ({ pageParam }) => get(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: hasHydrated,
  });
}

export const useGroupStream = (slug: string) => useStream((r) => groupKeys.stream(slug, r), (c) => getGroupStream(slug, c));

export const useBookStream = (materialId: string) => useStream((r) => materialKeys.stream(materialId, r), (c) => getBookStream(materialId, c));

/** The reader's book room head (the cover) and the group your note on the
 * book also shows in, for the "where it goes" line. */
export function useReaderRoomHead(materialId: string) {
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const readerId = useSessionStore((s) => s.readerId);
  const { data } = useQuery({
    queryKey: materialKeys.readerRoom(materialId, readerId),
    queryFn: () => getReaderRoomHead(materialId),
    enabled: hasHydrated,
    staleTime: 5 * 60_000,
  });
  return { book: data ?? null, group: data?.group ?? null };
}

/** Rewrites one note wherever a cache holds it. */
export type NotePatcher = (queryClient: QueryClient, noteId: string, patch: (n: RoomNote) => RoomNote) => void;

/** Rewrites one note in a room's cached stream (its pages as fetched). */
function patchNote(queryClient: QueryClient, key: QueryKey, noteId: string, patch: (n: RoomNote) => RoomNote) {
  queryClient.setQueryData<StreamCache>(
    key,
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((it) => (it.t === "note" && it.note.note.id === noteId ? { ...it, note: patch(it.note) } : it)),
        })),
      }
  );
}

const inStream = (key: QueryKey): NotePatcher => (qc, id, patch) => patchNote(qc, key, id, patch);

/** Patches a note (or, `rootId`, a reply in its thread) in a room's
 * cached stream; `null` takes it out. */
export function patchStreamNote(queryClient: QueryClient, key: QueryKey, rootId: string, noteId: string, patch: (n: Note) => Note | null) {
  queryClient.setQueryData<StreamCache>(
    key,
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.flatMap((it): RoomItem[] => {
            if (it.t !== "note" || it.note.note.id !== rootId) return [it];
            if (noteId === rootId) {
              const note = patch(it.note.note);
              return note ? [{ ...it, note: { ...it.note, note } }] : [];
            }
            const replies = it.note.replies.flatMap((r) => (r.id === noteId ? (patch(r) ?? []) : [r]));
            const gone = it.note.replies.length - replies.length;
            return [{ ...it, note: { ...it.note, replies, replyCount: it.note.replyCount - gone } }];
          }),
        })),
      }
  );
}

/** A heart on a note in a room, or on a reply in its thread (`rootId`):
 * flipped at once, put back if the write fails. `patcher`: a cache other
 * than the room's stream (Home's passage). */
export function useRoomHeart(key: QueryKey, patcher: NotePatcher = inStream(key)) {
  const queryClient = useQueryClient();
  const flip = ({ noteId, rootId = noteId }: { noteId: string; rootId?: string }) =>
    patcher(queryClient, rootId, (n) =>
      noteId === rootId ? { ...n, note: flipReaction(n.note) } : { ...n, replies: n.replies.map((r) => (r.id === noteId ? flipReaction(r) : r)) }
    );
  return useMutation({
    mutationFn: ({ noteId }: { noteId: string; rootId?: string }) => apiFetch<void>(`/community/notes/${noteId}/reactions`, { method: "POST" }),
    onMutate: flip,
    onError: (_err, target) => flip(target),
  });
}

/** Deletes a note from a room (with its replies, the server's cascade),
 * or one reply (`rootId`, its note): out of the stream at once, back if
 * the delete fails. `notes`: the book's notes in the reader, whose marks
 * follow. */
export function useRoomDelete(key: QueryKey, notes?: QueryKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId }: { noteId: string; rootId?: string }) => apiFetch<void>(`/community/notes/${noteId}`, { method: "DELETE" }),
    onMutate: ({ noteId, rootId = noteId }) => patchStreamNote(queryClient, key, rootId, noteId, () => null),
    onError: () => showToast("Couldn’t delete it. Try again."),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      if (notes) void queryClient.invalidateQueries({ queryKey: notes });
    },
  });
}

/** Your note made public or private from a room: flipped at once, back if
 * the write fails; `notes` as useRoomDelete's. */
export function useRoomVisibility(key: QueryKey, notes?: QueryKey) {
  const queryClient = useQueryClient();
  const set = (noteId: string, visibility: NoteVisibility) => patchStreamNote(queryClient, key, noteId, noteId, (n) => ({ ...n, visibility }));
  return useMutation({
    mutationFn: ({ noteId, visibility }: { noteId: string; visibility: NoteVisibility }) =>
      apiFetch<void>(`/community/notes/${noteId}`, { method: "PATCH", json: { visibility } }),
    onMutate: ({ noteId, visibility }) => set(noteId, visibility),
    onError: (_err, { noteId, visibility }) => {
      set(noteId, visibility === "public" ? "private" : "public");
      showToast("Couldn’t change it. Try again.");
    },
    onSettled: () => notes && queryClient.invalidateQueries({ queryKey: notes }),
  });
}

/** A note on its own page (/note/[id]), with what it takes to react,
 * reply and delete there as in a room. Deleting the note itself leaves the
 * page (`onGone`); a reply goes at once, back if the delete fails. */
export function useNoteThread(noteId: string, onGone: () => void) {
  const queryClient = useQueryClient();
  const key = communityKeys.thread(noteId);
  const thread = useQuery({ queryKey: key, queryFn: () => apiFetch<NoteThread>(`/community/notes/${encodeURIComponent(noteId)}`) });
  const patcher: NotePatcher = (qc, id, patch) => qc.setQueryData<NoteThread>(key, (t) => (t && t.note.id === id ? { ...t, ...patch(t) } : t));
  const heart = useRoomHeart(key, patcher);
  const reply = useRoomReply(key, patcher);
  const del = useMutation({
    mutationFn: ({ noteId }: { noteId: string; rootId: string }) => apiFetch<void>(`/community/notes/${noteId}`, { method: "DELETE" }),
    onMutate: ({ noteId, rootId }) => {
      if (noteId !== rootId) patcher(queryClient, rootId, (n) => ({ ...n, replies: n.replies.filter((r) => r.id !== noteId), replyCount: n.replyCount - 1 }));
    },
    onSuccess: (_d, { noteId, rootId }) => noteId === rootId && onGone(),
    onError: () => showToast("Couldn’t delete it. Try again."),
    onSettled: (_d, _e, { noteId, rootId }) => noteId !== rootId && queryClient.invalidateQueries({ queryKey: key }),
  });
  return { thread, heart, reply, del };
}

/** The viewer as a note's author, for what they send before it's saved. */
export function useAuthor(): Note["author"] {
  const readerId = useSessionStore((s) => s.readerId);
  const { data: profile } = useProfile();
  return { readerId: readerId ?? "", pseudonym: profile?.pseudonym ?? "", city: profile?.city ?? null, avatar: profile?.avatar ?? null };
}

/** A reply in a note's thread (sheet #c2): in the thread at once, and taken
 * out again, with a toast, if it doesn't save. `replyingTo` is a reply in
 * that thread being answered: the server files it under the root and
 * stamps `replyingToId`, so it's shown that way here. `ranges`: the note's
 * passage, which a reply must repeat (the server checks).
 * Resolves to whether it saved. */
export function useRoomReply(key: QueryKey, patcher: NotePatcher = inStream(key)) {
  const queryClient = useQueryClient();
  const create = useCreateNote(null);
  const author = useAuthor();
  return (rootId: string, { text, mentions }: { text: string; mentions: string[] }, replyingTo?: string, ranges: AnnotationRange[] = []) => {
    const id = makeTempId();
    const reply: Note = { ...pendingNote(id, text, author, new Date().toISOString()).note, parentId: rootId, replyingToId: replyingTo ?? null };
    const edit = (replies: (r: Note[]) => Note[]) => patcher(queryClient, rootId, (n) => ({ ...n, replies: replies(n.replies) }));
    edit((r) => [...r, reply]);
    return create
      .mutateAsync({ ranges, content: { kind: "text", text }, parentId: replyingTo ?? rootId, mentionReaderIds: mentions })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: key });
        return true;
      })
      .catch(() => {
        edit((r) => r.filter((x) => x.id !== id));
        showToast("Couldn’t send your reply. Try again.");
        return false;
      });
  };
}

type Pending = { note: RoomNote; input: CreateNoteInput; state: "sending" | "sent" | "failed" };

/**
 * Your notes on their way into a room (sheet #c1): shown at once, as sent,
 * while they go in the background; failed with Retry. Once saved, a note
 * takes its server id, so the room drops this copy (roomItems) the moment
 * its refetch has it — no gap, no double. `to` is
 * where they go: the group (a discussion post in it), or a book (a note on
 * it, routed by spec §5.3).
 */
export function useRoomSend(key: QueryKey, to: { groupSlug: string } | { materialId: string }) {
  const queryClient = useQueryClient();
  const create = useCreateNote("materialId" in to ? to.materialId : null);
  const post: Partial<CreateNoteInput> = "groupSlug" in to ? { threadType: "discussion", groupSlug: to.groupSlug } : {};
  const author = useAuthor();
  const [pending, setPending] = useState<Pending[]>([]);
  const mark = (id: string, state: Pending["state"] | null, savedId = id) =>
    setPending((all) =>
      state
        ? all.map((p) => (p.note.note.id === id ? { ...p, state, note: { ...p.note, note: { ...p.note.note, id: savedId } } } : p))
        : all.filter((p) => p.note.note.id !== id),
    );

  const run = async (id: string, input: CreateNoteInput) => {
    mark(id, "sending");
    let saved: string;
    try {
      saved = (await create.mutateAsync(input)).id;
    } catch {
      return mark(id, "failed");
    }
    mark(id, "sent", saved);
    await queryClient.invalidateQueries({ queryKey: key });
    mark(saved, null);
  };

  const items = useMemo(() => pending.map((p): RoomItem => ({ t: "note", note: p.note })), [pending]);
  const states = useMemo(() => Object.fromEntries(pending.map((p) => [p.note.note.id, p.state])), [pending]);
  return {
    items,
    states,
    /** From the reader (rooms-spec §5.3), a note can carry its passage
     * (`ranges`, shown as `quote`) and the lock. */
    send({ text, mentions, ranges = [], quote = null, locked = false }: { text: string; mentions: string[]; ranges?: AnnotationRange[]; quote?: { text: string; cite: string } | null; locked?: boolean }) {
      const id = makeTempId();
      const input: CreateNoteInput = { ranges, content: { kind: "text", text }, ...post, mentionReaderIds: mentions, ...(locked && { visibility: "private" }) };
      const base = pendingNote(id, text, author, new Date().toISOString());
      const note: RoomNote = {
        ...base,
        note: { ...base.note, ranges, visibility: locked ? "private" : "public" },
        excerpt: quote?.text ?? null,
        label: quote?.cite ?? null,
        fromReader: !!quote,
      };
      setPending((all) => [...all, { note, input, state: "sending" }]);
      void run(id, input);
    },
    retry(id: string) {
      const p = pending.find((x) => x.note.note.id === id);
      if (p) void run(id, p.input);
    },
  };
}

"use client";

import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { materialKeys } from "@/lib/materials/queryKeys";
import { makeTempId } from "@/lib/api/optimisticId";
import { useSessionStore } from "@/stores/session-store";
import type { AnnotationRange, Highlight, NoteVisibility } from "@/lib/api/types";
import type { RoomStreamPage } from "@/lib/rooms/types";

/** `POST /api/materials/{materialId}/highlights` — shows the highlight the
 * instant it's tapped rather than waiting on the round trip: `onMutate`
 * writes a temp row straight into the cache PassageContent/useAnnotations
 * already render from, `onError` rolls it back (the caller surfaces the
 * failure inline — see SelectionMenu's `override` slot), and `onSuccess`
 * swaps the temp row for the real one no extra refetch needed, since the
 * POST response is already the authoritative row. */
export function useCreateHighlight(materialId: string) {
  const queryClient = useQueryClient();
  const readerId = useSessionStore((s) => s.readerId);
  return useMutation({
    mutationFn: (ranges: AnnotationRange[]) =>
      apiFetch<Highlight>(`/materials/${materialId}/highlights`, { json: { ranges } }),
    onMutate: async (ranges) => {
      const key = materialKeys.highlights(materialId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Highlight[]>(key);
      const tempId = makeTempId();
      const now = new Date().toISOString();
      const optimistic: Highlight = { id: tempId, materialId, readerId: readerId ?? "", ranges, visibility: "public", createdAt: now, updatedAt: now };
      queryClient.setQueryData<Highlight[]>(key, (old = []) => [...old, optimistic]);
      return { previous, tempId };
    },
    onError: (_err, _ranges, context) => {
      if (context) queryClient.setQueryData(materialKeys.highlights(materialId), context.previous);
    },
    onSuccess: (created, _ranges, context) => {
      queryClient.setQueryData<Highlight[]>(materialKeys.highlights(materialId), (old = []) =>
        old.map((h) => (context && h.id === context.tempId ? created : h))
      );
      // The book's room shows it now.
      void queryClient.invalidateQueries({ queryKey: materialKeys.streamPrefix(materialId) });
    },
  });
}

/** `DELETE /api/materials/{materialId}/highlights/{highlightId}` — removes
 * the row from the cache and the room's stream immediately; a failure restores it (see
 * useCreateHighlight's doc comment for the same onMutate/onError shape). */
export function useDeleteHighlight(materialId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (highlightId: string) =>
      apiFetch<void>(`/materials/${materialId}/highlights/${highlightId}`, { method: "DELETE" }),
    onMutate: async (highlightId) => {
      const key = materialKeys.highlights(materialId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Highlight[]>(key);
      queryClient.setQueryData<Highlight[]>(key, (old = []) => old.filter((h) => h.id !== highlightId));
      queryClient.setQueriesData<InfiniteData<RoomStreamPage>>({ queryKey: materialKeys.streamPrefix(materialId) }, (data) =>
        data && { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.filter((it) => !(it.t === "highlight" && it.id === highlightId)) })) }
      );
      return { previous };
    },
    onError: (_err, _highlightId, context) => {
      if (context) queryClient.setQueryData(materialKeys.highlights(materialId), context.previous);
      void queryClient.invalidateQueries({ queryKey: materialKeys.streamPrefix(materialId) });
    },
  });
}

/** `PATCH .../highlights/{highlightId}` — public (in the book's room, with
 * your name) or private (only you). Flips it in the room's cached stream at
 * once; a failure flips it back. */
export function useSetHighlightVisibility(materialId: string) {
  const queryClient = useQueryClient();
  const set = (id: string, visibility: NoteVisibility) => {
    queryClient.setQueriesData<InfiniteData<RoomStreamPage>>({ queryKey: materialKeys.streamPrefix(materialId) }, (data) =>
      data && {
        ...data,
        pages: data.pages.map((p) => ({ ...p, items: p.items.map((it) => (it.t === "highlight" && it.id === id ? { ...it, visibility } : it)) })),
      }
    );
    queryClient.setQueryData<Highlight[]>(materialKeys.highlights(materialId), (old) => old?.map((h) => (h.id === id ? { ...h, visibility } : h)));
  };
  return useMutation({
    mutationFn: ({ id, visibility }: { id: string; visibility: NoteVisibility }) =>
      apiFetch<void>(`/materials/${materialId}/highlights/${id}`, { method: "PATCH", json: { visibility } }),
    onMutate: ({ id, visibility }) => set(id, visibility),
    onError: (_err, { id, visibility }) => set(id, visibility === "public" ? "private" : "public"),
  });
}

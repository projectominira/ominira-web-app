import { useMemo } from "react";
import { useMaterialNotes } from "@/lib/materials/useMaterialNotes";
import { buildAnnotationsForPassage, type Annotation } from "@/stores/library-store";
import type { AnnotationRange } from "@/lib/api/types";
import { useSessionStore } from "@/stores/session-store";

const EMPTY: never[] = [];

function bucketByPassage<T extends { ranges: AnnotationRange[] }>(rows: T[]): Record<string, T[]> {
  const byPassage: Record<string, T[]> = {};
  for (const row of rows) {
    for (const r of row.ranges) {
      (byPassage[r.passageId] ??= []).push(row);
    }
  }
  return byPassage;
}

/**
 * The single source of a material's Annotation[] view, fed by one server
 * query (every visible note, highlights being the empty ones) rather than a
 * zustand store — see stores/library-store.ts's own doc comment for the
 * fuller history. Computes the full per-passage grouping once (memoized on
 * the query result itself), so repeated per-passage lookups during render
 * stay O(1) the same way the old store-backed `annotationsByPassage` cache
 * did.
 */
export function useAnnotations(materialId: string) {
  const { data: notes = EMPTY } = useMaterialNotes(materialId);
  const viewerId = useSessionStore((s) => s.readerId);

  const annotationsByPassage = useMemo(() => {
    const map: Record<string, Annotation[]> = {};
    for (const [passageId, list] of Object.entries(bucketByPassage(notes))) map[passageId] = buildAnnotationsForPassage(list, viewerId);
    return map;
  }, [notes, viewerId]);

  // Every Annotation in the material, deduped by id (a multi-passage
  // annotation lands in more than one passage's bucket, same object
  // reference) — for the book-wide annotation feed, not per-passage
  // rendering (see useFeed).
  const allAnnotations = useMemo(() => {
    const byId = new Map<string, Annotation>();
    for (const list of Object.values(annotationsByPassage)) {
      for (const a of list) if (!byId.has(a.id)) byId.set(a.id, a);
    }
    return Array.from(byId.values());
  }, [annotationsByPassage]);

  return { notes, annotationsByPassage, allAnnotations };
}

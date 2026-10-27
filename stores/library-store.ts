import type { AnnotationRange, Note, NoteContent } from "@/lib/api/types";

// Re-exported so every existing call site (~15 files) keeps importing these
// three from "@/stores/library-store" rather than churning every import
// path in the same pass that already renames NoteEntry -> Note everywhere
// (api-spec.md: "converge on the API's names instead of keeping two
// client-side vocabularies" — plan.md's Phase 6).
export type { AnnotationRange, NoteContent, Note };

/** A note with no words: a highlight. */
export const isEmptyNote = (n: Note) => n.content.kind === "text" && n.content.text.trim() === "";

/**
 * Read-only, *computed* view combining whatever Note rows (real server
 * rows, api-spec.md's shape — never itself the unit of storage or
 * mutation) share one exact set of ranges — the shape the
 * reading UI actually wants (one marked span, one note thread underneath
 * it). `id` is deterministic (derived from `ranges`, see `rangesKey`), not
 * a persisted uuid — every mutation (create/delete highlight, create/edit/
 * delete note) acts on a Highlight or Note row directly, by *its own*
 * server-assigned id; `buildAnnotationsForPassage` assembles this view
 * fresh from whatever TanStack Query currently holds for a material (see
 * lib/reader/useAnnotations.ts), not from a store this module owns anymore
 * — this file is pure functions now, no zustand `create()`, no persist.
 * (History: this used to be the zustand store holding *all* local reading
 * state — persist/localStorage-backed highlights+notes+position. Phase 6
 * split it: position moved to stores/reading-position-store.ts, and
 * highlights/notes became real server rows fetched via TanStack Query —
 * this file kept only the grouping logic that turns raw Highlight[]/Note[]
 * into the Annotation[] view components actually render, since that logic
 * has nothing to do with where the raw rows come from.)
 *
 * `notes` is the *entire* thread, flattened — every reply at every depth,
 * not just the top-level ones — since every row in it shares this same
 * `ranges` regardless of nesting (see Note.parentId). Callers that care
 * about thread structure (NotesSidebar) group this flat list by `parentId`
 * themselves (lib/reader/noteThread.ts) rather than this view baking in one
 * fixed shape for it.
 */
export type Annotation = {
  id: string;
  ranges: AnnotationRange[];
  highlighted: boolean;
  /** The viewer's own empty note here (their highlight), which the
   * selection's Highlight removes and their first words fill in. */
  highlightId?: string;
  notes: Note[];
  // Last activity in this group (ms epoch) — any note created/edited, derived from the max `updatedAt` among every
  // constituent row. Individual notes also carry their own `updatedAt`.
  savedAt: number;
};

export function rangesKey(ranges: AnnotationRange[]): string {
  return ranges.map((r) => `${r.passageId}:${r.start}:${r.end}`).join("|");
}

export function sameRanges(a: AnnotationRange[], b: AnnotationRange[]): boolean {
  return a.length === b.length && a.every((r, i) => r.passageId === b[i].passageId && r.start === b[i].start && r.end === b[i].end);
}

/** Groups whichever notes touch one shared passage (see
 * lib/reader/useAnnotations.ts, which buckets by passageId before calling
 * this) by their exact shared `ranges` into the Annotation[] view
 * PassageText/NotesSidebar actually read. A row's own `ranges` may reach
 * into neighboring passages too — irrelevant here, beyond being part of
 * the grouping key. It's `highlighted` where the viewer has an empty
 * note of their own. */
export function buildAnnotationsForPassage(notes: Note[], viewerId: string | null): Annotation[] {
  const groups = new Map<string, { ranges: AnnotationRange[]; highlightId?: string; notes: Note[]; savedAt: number }>();
  for (const n of notes) {
    const key = rangesKey(n.ranges);
    const g = groups.get(key) ?? { ranges: n.ranges, notes: [], savedAt: 0 };
    g.notes.push(n);
    if (!n.parentId && viewerId && n.author.readerId === viewerId && isEmptyNote(n)) g.highlightId = n.id;
    g.savedAt = Math.max(g.savedAt, Date.parse(n.updatedAt));
    groups.set(key, g);
  }
  return Array.from(groups.entries()).map(([key, g]) => ({
    id: key,
    ranges: g.ranges,
    highlighted: g.highlightId !== undefined,
    highlightId: g.highlightId,
    notes: g.notes,
    savedAt: g.savedAt,
  }));
}

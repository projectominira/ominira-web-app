// Highlight counts (rooms-spec §5.4): how many people marked a line, never
// who (public highlights name their reader in the book's room). Pure: the counts are
// worked out from the lines its notes are on (lib/rooms/highlights).

import type { AnnotationRange } from "@/lib/api/types";

/** A line marked by several comrades: the reader's dotted underline and
 * "24 comrades marked this line". */
export type Mark = { passageId: string; start: number; end: number; count: number };

/** Fewer than this isn't "marked by comrades". */
export const MIN_MARKED = 2;

type Interval = [start: number, end: number];

/** One reader's spans in a passage, overlaps merged, so they count once. */
function union(spans: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const [s, e] of [...spans].sort((a, b) => a[0] - b[0])) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

/**
 * Splits each passage where marks start and end, and counts the readers
 * over each piece; pieces at `min` or more are kept, and touching pieces
 * with the same count join up. The viewer's own highlights don't count:
 * they're theirs, drawn as their own.
 */
export function markedSegments(
  highlights: { readerId: string; ranges: AnnotationRange[] }[],
  viewerId: string | null,
  min = MIN_MARKED,
): Mark[] {
  // passage -> reader -> spans
  const byPassage = new Map<string, Map<string, Interval[]>>();
  for (const h of highlights) {
    if (h.readerId === viewerId) continue;
    for (const r of h.ranges) {
      if (!(r.end > r.start)) continue;
      const readers = byPassage.get(r.passageId) ?? new Map<string, Interval[]>();
      byPassage.set(r.passageId, readers);
      readers.set(h.readerId, [...(readers.get(h.readerId) ?? []), [r.start, r.end]]);
    }
  }

  const marks: Mark[] = [];
  for (const [passageId, readers] of byPassage) {
    if (readers.size < min) continue;
    const delta = new Map<number, number>();
    for (const spans of readers.values()) {
      for (const [s, e] of union(spans)) {
        delta.set(s, (delta.get(s) ?? 0) + 1);
        delta.set(e, (delta.get(e) ?? 0) - 1);
      }
    }
    const points = [...delta.keys()].sort((a, b) => a - b);
    let count = 0;
    for (let i = 0; i < points.length - 1; i++) {
      count += delta.get(points[i])!;
      if (count < min) continue;
      const last = marks[marks.length - 1];
      if (last && last.passageId === passageId && last.end === points[i] && last.count === count) last.end = points[i + 1];
      else marks.push({ passageId, start: points[i], end: points[i + 1], count });
    }
  }
  return marks;
}

/** How many comrades marked the line a highlight covers: the most over any
 * piece of it ("24 comrades marked this line"); 0 when none did. */
export function markedCount(ranges: AnnotationRange[], marks: Mark[]): number {
  let most = 0;
  for (const r of ranges)
    for (const m of marks) if (m.passageId === r.passageId && m.start < r.end && r.start < m.end) most = Math.max(most, m.count);
  return most;
}

/** The lines most marked by comrades, most first (frames 12d, 13d). */
export function mostMarked(marks: Mark[], n = 3): Mark[] {
  return [...marks].sort((a, b) => b.count - a.count).slice(0, n);
}

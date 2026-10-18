import type { Note } from "@/lib/api/types";

/** One reply where a thread shows it. `to` names whom it answers only where
 * the threadline can't: a nested reply answering another nested reply. */
export type ThreadEntry = { reply: Note; depth: 1 | 2; to: Note | null };

/** A note's replies (chronological) in reading order: each direct reply
 * starts a branch, followed by every reply under it — to it, or to one of
 * those — so an answer never lands under someone it doesn't answer. Two
 * levels at most; branches and the replies in each stay in time order. A
 * reply whose target isn't here (deleted, or not visible) starts its own. */
export function threadOrder(replies: Note[]): ThreadEntry[] {
  const byId = new Map(replies.map((r) => [r.id, r]));
  const branchOf = (r: Note) => {
    const seen = new Set<string>();
    let cur = r;
    while (cur.replyingToId && byId.has(cur.replyingToId) && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.replyingToId)!;
    }
    return cur;
  };
  const branches = new Map<string, ThreadEntry[]>();
  for (const r of replies) if (branchOf(r) === r) branches.set(r.id, [{ reply: r, depth: 1, to: null }]);
  for (const r of replies) {
    const head = branchOf(r);
    if (head === r) continue;
    const to = byId.get(r.replyingToId!)!;
    branches.get(head.id)!.push({ reply: r, depth: 2, to: to === head ? null : to });
  }
  return [...branches.values()].flat();
}

/** Where a thread collapsed to its latest `keep` replies starts: never
 * mid-branch, so a nested reply always shows with the one it hangs off. */
export function collapsedStart(entries: ThreadEntry[], keep: number): number {
  let start = Math.max(0, entries.length - keep);
  while (start > 0 && entries[start].depth === 2) start--;
  return start;
}

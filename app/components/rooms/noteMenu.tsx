import { Trash2 } from "lucide-react";
import type { OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";
import type { Note } from "@/lib/api/types";
import { confirmAction } from "@/stores/confirm-store";

/** What a note's or reply's ⋯ offers: Delete for its author, Remove for a
 * group's moderators. Asks first; a note's replies go with it. Empty (no ⋯)
 * for anyone else. */
export function noteMenu(note: Note, viewerId: string | null, moderator: boolean, replies: number, onDelete: () => void): OverflowMenuItem[] {
  const own = !!viewerId && note.author.readerId === viewerId;
  if (!own && !moderator) return [];
  const what = note.parentId ? "reply" : "note";
  const verb = own ? "Delete" : "Remove";
  const ask = async () => {
    const message = replies > 0 ? `Its ${replies === 1 ? "reply goes" : `${replies} replies go`} too.` : "This can’t be undone.";
    if (await confirmAction({ title: `${verb} this ${what}?`, message, confirmLabel: verb, danger: true })) onDelete();
  };
  return [{ label: verb, icon: <Trash2 size={13} />, danger: true, onClick: () => void ask() }];
}

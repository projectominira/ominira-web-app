import { Eye, Lock, Pin, PinOff, Trash2 } from "lucide-react";
import type { OverflowMenuItem } from "@/app/components/reader/notes/OverflowMenu";
import type { Note, NoteVisibility } from "@/lib/api/types";
import { confirmAction } from "@/stores/confirm-store";

/** What a note's or reply's ⋯ offers: Delete for its author, Remove for a
 * group's moderators, who can also Pin a note to the room's strip (`pin`).
 * Your note can be made public or private (`visibility`). Asks first;
 * a note's replies go with it. Empty (no ⋯) for anyone else. */
export function noteMenu(
  note: Note,
  viewerId: string | null,
  moderator: boolean,
  replies: number,
  onDelete: () => void,
  pin?: { pinned: boolean; onToggle: (pin: boolean) => void },
  visibility?: (visibility: NoteVisibility) => void,
): OverflowMenuItem[] {
  const own = !!viewerId && note.author.readerId === viewerId;
  if (!own && !moderator) return [];
  const what = note.parentId ? "reply" : "note";
  const verb = own ? "Delete" : "Remove";
  const ask = async () => {
    const message = replies > 0 ? `Its ${replies === 1 ? "reply goes" : `${replies} replies go`} too.` : "This can’t be undone.";
    if (await confirmAction({ title: `${verb} this ${what}?`, message, confirmLabel: verb, danger: true })) onDelete();
  };
  return [
    ...(pin
      ? [pin.pinned ? { label: "Unpin", icon: <PinOff size={13} />, onClick: () => pin.onToggle(false) } : { label: "Pin to chat", icon: <Pin size={13} />, onClick: () => pin.onToggle(true) }]
      : []),
    ...(own && visibility && !note.parentId
      ? [
          note.visibility === "private"
            ? { label: "Make public", icon: <Eye size={13} />, onClick: () => visibility("public") }
            : { label: "Make private", icon: <Lock size={13} />, onClick: () => visibility("private") },
        ]
      : []),
    { label: verb, icon: <Trash2 size={13} />, danger: true, onClick: () => void ask() },
  ];
}

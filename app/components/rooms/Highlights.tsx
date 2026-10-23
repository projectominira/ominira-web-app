"use client";

import { Trash2 } from "lucide-react";
import type { NoteVisibility } from "@/lib/api/types";
import { isTempId } from "@/lib/api/optimisticId";
import { chapterLabel } from "@/lib/groups/copy";
import type { RoomItem } from "@/lib/rooms/types";
import PassageQuote from "./PassageQuote";
import { ShareSwitch } from "./RoomInput";
import { CardAuthor, RoomCard } from "./RoomCard";
import { Menu } from "./NoteBubble";
import { confirmAction } from "@/stores/confirm-store";

// Highlights in a book's room: a note's card with the line and no words.
// Public ones show to everyone with the name; a private one only to you,
// dotted like a private note. Your own carries a "Make private" switch
// and a ⋯ with Delete (after asking), both held off while it's still saving.

export function HighlightCard({
  item,
  viewerId,
  now,
  flash = false,
  onVisibility,
  onDelete,
  onOpen,
}: {
  item: Extract<RoomItem, { t: "highlight" }>;
  viewerId: string | null;
  now: number;
  flash?: boolean;
  onVisibility?: (visibility: NoteVisibility) => void;
  onDelete?: () => void;
  /** Opens the line in place of following its link (inside the reader). */
  onOpen?: () => void;
}) {
  const priv = item.visibility === "private";
  const mine = item.author.readerId === viewerId;
  const saving = isTempId(item.id);
  const del = async () => {
    if (await confirmAction({ title: "Delete this highlight?", message: "This can’t be undone.", confirmLabel: "Delete", danger: true })) onDelete?.();
  };
  return (
    <RoomCard priv={priv} flash={flash}>
      <CardAuthor
        author={item.author}
        viewerId={viewerId}
        at={item.at}
        now={now}
        priv={priv}
        menu={mine && onDelete && !saving && <Menu items={[{ label: "Delete", icon: <Trash2 size={13} />, danger: true, onClick: () => void del() }]} />}
      />
      <PassageQuote excerpt={item.excerpt} cite={item.label ? chapterLabel(item.label) : null} href={onOpen ? null : item.href} onClick={onOpen} />
      {mine && onVisibility && <ShareSwitch on={priv} disabled={saving} onChange={(on) => onVisibility(on ? "private" : "public")} />}
    </RoomCard>
  );
}

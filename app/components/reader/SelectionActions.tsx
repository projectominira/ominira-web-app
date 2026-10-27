"use client";

import { useState, useSyncExternalStore } from "react";
import { ArrowLeft, Copy, Eye, Headphones, Image as ImageIcon, Highlighter, MessageCircle, MessageSquareQuote, Share, Trash2 } from "lucide-react";
import { useNarrationBarHeight } from "@/app/components/useBottomDock";
import { quoteForRanges } from "@/lib/reader/annotationSelection";
import type { SelectionOverlay, SelectionState } from "@/lib/reader/useTextAnnotations";
import { useShareToRoom } from "@/lib/room/sharePassage";
import { useReaderStore } from "@/stores/reader-store";
import MembersOnlyPrompt from "./notes/MembersOnlyPrompt";
import SelectionMenu, { type Item } from "./SelectionMenu";
import { confirmAction, DELETE_ANNOTATION } from "@/stores/confirm-store";

const NARROW_QUERY = "(max-width: 859px)";
/** The phone/desktop split every reader uses (useSectionCarousel's 860px) —
 * picks the bottom-bar menu and the bottom-sheet notes panel. */
export function useNarrowViewport() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(NARROW_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false
  );
}

/**
 * The selection menu for every reader (EPUB, PDF, DOCX, web article) — the
 * one place its actions are defined: Highlight (private), Add note, Copy,
 * Listen, Share…, Delete. Share… swaps the list in place for Share as image,
 * Share publicly and Share in live room, with a Back row. Also the
 * signed-out / couldn't-save prompts that replace it in place.
 *
 * Listen shows only when the reader passes `onListenFrom`; Share in live room
 * only while the reader is in this material's room; Share publicly until
 * your mark is public; Delete only on an existing mark.
 */
export default function SelectionActions({
  materialId,
  selection,
  overlay,
  getPassageText,
  locationLabel,
  hasExistingAnnotation,
  onHighlight,
  onNote,
  canSharePublicly,
  onSharePublicly,
  onDelete,
  onDismiss,
  onDismissOverlay,
  onListenFrom,
  onShare,
  onSharedToRoom,
}: {
  materialId: string;
  selection: SelectionState | null;
  overlay: SelectionOverlay | null;
  getPassageText: (passageId: string) => string;
  /** The label a passage shared to the room carries (chapter, page…). */
  locationLabel: (passageId: string) => string;
  hasExistingAnnotation: boolean;
  onHighlight: () => void;
  onNote: () => void;
  /** False once your mark here is already public. */
  canSharePublicly: boolean;
  /** Makes your highlight public — the room and your group see it. */
  onSharePublicly: () => void;
  onDelete: () => void;
  onDismiss: () => void;
  onDismissOverlay: () => void;
  /** Narration from the selection's first word: its passage and offset. */
  onListenFrom?: (passageId: string, offset: number) => void;
  /** Opens the quote card (useShareQuote's `share`). */
  onShare: (quote: string) => void;
  /** After a share to the room — the reader opens its room feed. */
  onSharedToRoom: () => void;
}) {
  // The mobile list sits on the narration bar; the room's mini-player
  // floats above it.
  const narrationHeight = useNarrationBarHeight();
  const theme = useReaderStore((s) => s.theme);
  const isMobile = useNarrowViewport();
  const shareToRoom = useShareToRoom(materialId);
  const [copied, setCopied] = useState(false);
  // The selection the Share options are open for — a new selection opens on
  // the main list again.
  const [sharingFor, setSharingFor] = useState<SelectionState | null>(null);

  const iconSize = isMobile ? 18 : 14;
  const items = (): Item[] => {
    if (!selection) return [];
    const { ranges } = selection;
    const quote = () => quoteForRanges(ranges, getPassageText);
    if (sharingFor === selection) {
      return [
        { key: "back", icon: <ArrowLeft size={iconSize} />, label: "Back", onClick: () => setSharingFor(null) },
        {
          key: "image",
          icon: <ImageIcon size={iconSize} />,
          label: "Share as image",
          onClick: () => {
            onShare(quote());
            onDismiss();
          },
        },
        ...(canSharePublicly
          ? [{ key: "public", icon: <Eye size={iconSize} />, label: "Share publicly", onClick: onSharePublicly }]
          : []),
        ...(shareToRoom
          ? [
              {
                key: "room",
                icon: <MessageSquareQuote size={iconSize} />,
                label: "Share in live room",
                onClick: () => {
                  shareToRoom({ ranges, quote: quote(), label: locationLabel(ranges[0].passageId) });
                  onSharedToRoom();
                  onDismiss();
                },
              },
            ]
          : []),
      ];
    }
    return [
      { key: "highlight", icon: <Highlighter size={iconSize} />, label: "Highlight", onClick: onHighlight },
      { key: "note", icon: <MessageCircle size={iconSize} />, label: "Add note", onClick: onNote },
      {
        key: "copy",
        icon: <Copy size={iconSize} />,
        label: copied ? "Copied ✓" : "Copy",
        onClick: () =>
          void navigator.clipboard.writeText(quote()).then(() => {
            setCopied(true);
            setTimeout(() => {
              setCopied(false);
              onDismiss();
            }, 800);
          }),
      },
      ...(onListenFrom
        ? [
            {
              key: "listen",
              icon: <Headphones size={iconSize} />,
              label: "Listen",
              onClick: () => {
                onListenFrom(ranges[0].passageId, ranges[0].start);
                onDismiss();
              },
            },
          ]
        : []),
      { key: "share", icon: <Share size={iconSize} />, label: "Share…", onClick: () => setSharingFor(selection) },
      ...(hasExistingAnnotation
        ? [{ key: "delete", icon: <Trash2 size={iconSize} />, label: "Delete", onClick: async () => {
          if (await confirmAction(DELETE_ANNOTATION)) onDelete();
        }, danger: true }]
        : []),
    ];
  };

  return (
    <>
      {selection && (
        <SelectionMenu
          anchor={selection.anchor}
          isMobile={isMobile}
          bottomOffsetPx={narrationHeight}
          theme={theme}
          items={items()}
          onDismiss={onDismiss}
        />
      )}
      {/* Replaces the menu in place — a signed-out highlight attempt (stays up
          until dismissed) or a failed save (self-clears). Never both at once:
          highlighting/deleting clears the selection before setting this. */}
      {overlay && (
        <SelectionMenu
          anchor={overlay.anchor}
          isMobile={isMobile}
          bottomOffsetPx={narrationHeight}
          theme={theme}
          items={[]}
          override={
            overlay.kind === "auth" ? (
              <MembersOnlyPrompt action="highlight" onClose={onDismissOverlay} />
            ) : (
              <div className="rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)] p-3.5">
                <p className="m-0 text-[13px] font-medium leading-relaxed text-[var(--reader-text-muted)]">
                  Couldn&rsquo;t save — check your connection and try again.
                </p>
              </div>
            )
          }
          onDismiss={onDismissOverlay}
        />
      )}
    </>
  );
}

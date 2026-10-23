"use client";

import { useState } from "react";
import type { AnnotationRange } from "@/lib/api/types";
import { sameRanges } from "@/stores/library-store";
import { useSessionStore } from "@/stores/session-store";
import { useAnnotations } from "@/lib/reader/useAnnotations";
import { useDeleteHighlight, useSetHighlightVisibility } from "@/lib/materials/useHighlightMutations";
import { useHighlights } from "@/lib/materials/useHighlights";
import { useProfile } from "@/lib/auth/useProfile";
import { useNow } from "@/lib/time/useNow";
import { useCreateNote } from "@/lib/community/useNoteMutations";
import { quoteForRanges } from "@/lib/reader/annotationSelection";
import { topLevelNotes, repliesFor, sortNotes, type NoteSortMode } from "@/lib/reader/noteThread";
import { useThreadInteraction } from "@/lib/reader/useThreadInteraction";
import NoteThreadCard from "./notes/NoteThreadCard";
import NoteComposer from "./notes/NoteComposer";
import PanelShell from "./notes/PanelShell";
import HighlightCard from "./notes/HighlightCard";
import { HighlightCard as RoomHighlightCard } from "@/app/components/rooms/Highlights";
// import SortToggle from "./notes/SortToggle";

type Props = {
  materialId: string;
  /** The passage this panel was opened from — one of possibly several the
   * annotation's ranges touch. */
  passageId: string;
  /** Resolves any passage's full plain text by id, so a cross-passage
   * annotation's quote can be assembled from more than one passage. */
  getPassageText: (passageId: string) => string;
  /** The run (chapter) a passage sits in, for the highlight card's cite. */
  locationLabel: (passageId: string) => string;
  /** An existing annotation (thread) being viewed/added to. */
  annotationId?: string;
  /** A brand-new thread with no annotation yet — one range per passage the
   * just-made selection touched. */
  pendingRanges?: AnnotationRange[];
  /** Deep-links straight into editing one specific existing entry — absent,
   * the panel opens to the thread as normal. */
  editingNoteId?: string;
  /** When deep-linked from a notification, the specific thread (root note
   * id) whose replies should be fully expanded (show all). */
  targetThreadId?: string;
  panelType?: "side" | "sheet";
  onClose: () => void;
  /** Opened from over the book's feed: back to it. */
  onBack?: () => void;
};

function EditPanel({
  materialId,
  passageId,
  getPassageText,
  locationLabel,
  annotationId,
  pendingRanges,
  editingNoteId,
  targetThreadId,
  panelType,
  onClose,
  onBack,
}: Props) {
  const { annotationsByPassage } = useAnnotations(materialId);
  const annotations = annotationsByPassage[passageId] ?? [];
  const createNote = useCreateNote(materialId);
  const deleteHighlight = useDeleteHighlight(materialId);
  const readerId = useSessionStore((s) => s.readerId);
  const { data: highlights } = useHighlights(materialId);
  const { data: profile } = useProfile();
  const setVisibility = useSetHighlightVisibility(materialId);
  const now = useNow();

  // A brand-new thread has no annotationId yet — after its first note is
  // saved, the server creates one, but this component only has the ranges
  // it asked for, so it re-finds "the annotation it just made" by those
  // same ranges rather than an id it was never given.
  const existing = annotationId
    ? annotations.find((a) => a.id === annotationId)
    : pendingRanges
    ? annotations.find((a) => sameRanges(a.ranges, pendingRanges))
    : undefined;
  const ranges = existing?.ranges ?? pendingRanges ?? [];
  const quoteText = quoteForRanges(ranges, getPassageText);

  // The whole thread, flat — every top-level note and every reply, two
  // tiers only (see Note.parentId). Which top-level notes show their
  // replies expanded is local UI state below, not part of this data.
  const allNotes = existing?.notes ?? [];
  const roots = topLevelNotes(allNotes);

  const [sortMode, setSortMode] = useState<NoteSortMode>("chronological");

  const { ui, actions, expandedIds, toggleExpanded } = useThreadInteraction({
    materialId,
    ranges,
    allNotes,
    initialEditingId: editingNoteId,
  });

  // The card asks first. Its notes stay (each has its own ⋯); a bare
  // highlight's panel has nothing left to show, so it closes.
  const handleDeleteHighlight = (id: string) => {
    deleteHighlight.mutate(id);
    if (roots.length === 0) onClose();
  };

  const sortedRoots = sortNotes(roots, sortMode);

  // Your own highlight shows as the book room's card — your name, when, and
  // its public/private switch — with the notes under it, unquoted.
  const highlight = existing?.highlightId ? highlights?.find((h) => h.id === existing.highlightId) : undefined;
  const highlightCard = highlight && profile && (
    <RoomHighlightCard
      item={{
        t: "highlight",
        id: highlight.id,
        author: { readerId: highlight.readerId, pseudonym: profile.pseudonym, city: profile.city, avatar: profile.avatar },
        visibility: highlight.visibility,
        excerpt: quoteText,
        label: ranges[0] ? locationLabel(ranges[0].passageId) : "",
        ranges,
        href: null,
        at: highlight.createdAt,
      }}
      viewerId={readerId}
      now={now}
      onVisibility={(visibility) => setVisibility.mutate({ id: highlight.id, visibility })}
      onDelete={() => handleDeleteHighlight(highlight.id)}
    />
  );

  return (
    <PanelShell
      panelType={panelType}
      title=""
      onBack={onBack}
      onClose={onClose}
      footer={
        // Same bottom-docked composer as the book-wide feed panel
        // (FeedPanel) — pinned below the scrollable thread
        // regardless of scroll position, not part of the flowing content.
          <NoteComposer
            initialText=""
            placeholder="Share a note"
            showMemberPrompt
            action="note"
            draftKey={`highlight-${materialId}-${JSON.stringify(ranges)}`}
            onSave={(content, visibility) =>
              createNote.mutate(
                { ranges, content, visibility },
                { onError: () => ui.reportError("Couldn't save your note — check your connection and try again.") }
              )
            }
          />
      }
    >
      {/* Your highlight's room card heads the panel when there is one.
          Otherwise the bare quote is only shown here, above the thread list, when there's no note yet
          to attach it to (a fresh thread) — once a root note exists, its
          own NoteThreadCard renders this same quote itself, positioned
          after that note's AuthorRow rather than before it (see the
          `quote` prop passed below). Showing it in both places at once
          would repeat it once per root note. */}
      {highlightCard || (sortedRoots.length === 0 && <HighlightCard text={quoteText} />)}
      <>
          {/* {roots.length > 0 && <SortToggle mode={sortMode} onChange={setSortMode} />} */}

          {sortedRoots.length > 0 ? (
            <div className="flex flex-col gap-5">
              {sortedRoots.map((note) => (
                <NoteThreadCard
                  key={note.id}
                  quote={highlightCard ? undefined : quoteText}
                  note={note}
                  replies={repliesFor(allNotes, note.id)}
                  expanded={expandedIds.has(note.id)}
                  initialShowAll={targetThreadId === note.id}
                  onToggleExpand={() => toggleExpanded(note.id)}
                  ui={ui}
                  actions={actions}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--reader-text-muted)] text-center py-1 m-0">
              {/* No notes yet */}
            </p>
          )}

          {ui.actionError && (
            <p className="m-0 text-[11px] text-[var(--reader-text-muted)]">{ui.actionError}</p>
          )}
      </>
    </PanelShell>
  );
}

/** Private highlights/notes UI for one annotation — opened from clicking an
 * existing mark's "Add note"/"View thread" action, or from a fresh
 * selection's Note action. */
export default function NotesSidebar(props: Props) {
  return <EditPanel {...props} />;
}

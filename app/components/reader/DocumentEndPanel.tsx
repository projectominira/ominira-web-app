"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useReadingPositionStore, type PositionInput } from "@/stores/reading-position-store";
import { useSessionStore } from "@/stores/session-store";
import { useIsAuthenticated } from "@/lib/auth/useIsAuthenticated";
import { useCreateNote, useDeleteNote, useToggleReaction } from "@/lib/community/useNoteMutations";
import { useMaterialNotes } from "@/lib/materials/useMaterialNotes";
import { repliesFor, topLevelNotes } from "@/lib/reader/noteThread";
import { toRoomNote } from "@/lib/rooms/timeline";
import { useNow } from "@/lib/time/useNow";
import NoteBubble from "@/app/components/rooms/NoteBubble";
import NoteComposer from "./notes/NoteComposer";

/**
 * The end of a document, for every format — one shared component so "you've
 * finished this" is the same moment whether it closes an EPUB, a PDF, a DOCX or
 * a web article.
 *
 * It exists because completion is not derivable from progress: `locatorPercent`
 * divides an index by a count, so the final passage/page/block always lands
 * just short of 100 (see lib/reader/locator.ts's positionPercent). Rather than
 * fake a threshold, the reader says so here — explicitly, in every mode,
 * including listening. Reaching the end is not the same claim as having read
 * it: readers jump to the end, skim back matter, and land on appendices.
 *
 * Finishing is the screen's one call to action (Mark as finished), and once
 * done it's a moment of its own — the check, the date, "Undo" — before the
 * note it leads into ("Share a note"). Still a toggle:
 * Undo restores the real tracked percentage rather than leaving a fabricated
 * 100 behind.
 *
 * It renders as its own screen (a tall, centred section) rather than a block
 * under the last paragraph, so that in every format the end of a document reads
 * as a place the reader arrives at.
 *
 * The reflection composer is the same `NoteComposer` the reader's notes panel
 * uses, saving a general (`ranges: []`) note against this material — so a
 * closing thought lands in the community feed exactly like any other book-level
 * note, with no separate posting path to keep in sync. Those same book-level
 * notes are then listed here, so the end of a document shows what the room made
 * of it — in the one NoteBubble every note in the app renders through — and a
 * reflection written here appears immediately (useCreateNote's optimistic
 * write) instead of vanishing into a feed elsewhere. Signed-out readers get
 * NoteComposer's own membership prompt; the finish button is simply not
 * offered, since there's no reader row to record it against.
 */
export default function DocumentEndPanel({
  materialId,
  title,
  getCurrentPosition,
}: {
  materialId: string;
  title: string;
  /** Where the reader is *at the moment they tap*, for the case where finishing
   * is the very first thing ever recorded for this material (a short article
   * read in one screenful, with no committed position yet) — see setFinished.
   * A function, not a value: the honest answer is the one at click time, and
   * this panel re-renders for reasons unrelated to where the reader is. */
  getCurrentPosition: () => PositionInput | undefined;
}) {
  const isAuthenticated = useIsAuthenticated();
  const viewerId = useSessionStore((s) => s.readerId);
  const now = useNow();
  const finishedAt = useReadingPositionStore((s) => s.positions[materialId]?.finishedAt ?? null);
  const setFinished = useReadingPositionStore((s) => s.setFinished);
  const createNote = useCreateNote(materialId);
  const toggleReaction = useToggleReaction(materialId);
  const deleteNote = useDeleteNote(materialId);
  const [noteError, setNoteError] = useState<string | null>(null);
  const finish = (done: boolean) => setFinished(materialId, done, getCurrentPosition());

  // The material's book-level notes — the same `ranges: []` thread this panel
  // posts into, so a reflection appears here the instant it's written:
  // useCreateNote patches this very cache entry optimistically. Newest first,
  // under the composer, so yours lands at the top of the list.
  const { data: allNotes } = useMaterialNotes(materialId);
  const reflections = useMemo(() => {
    const ctx = { now, pinnedId: null, teamIds: new Set<string>(), officialIds: new Set<string>(), passages: new Map(), alsoIn: false };
    return topLevelNotes(allNotes)
      .filter((note) => note.ranges.length === 0)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((note) =>
        toRoomNote({ note, replies: repliesFor(allNotes, note.id), material: null, sectionId: null, label: null, excerpt: null }, ctx)
      );
  }, [allNotes, now]);

  const eyebrow = "text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--reader-text-subtle)]";
  // The reflection comes after finishing; signed out, the composer's own
  // membership prompt stands in for both.
  const reflecting = !isAuthenticated || finishedAt !== null;

  return (
    // A screen of its own, not a footnote under the last paragraph: min-h-[80dvh]
    // plus a centred column means the end of a document arrives as somewhere the
    // reader has *got to*, and the bottom padding keeps the composer clear of
    // whatever chrome the format's own viewer floats over the content (a pager,
    // a chapter footer, the now-playing bar).
    <section className="mt-16 flex min-h-[80dvh] flex-col justify-center border-t border-[var(--reader-border)] pt-12 pb-28">
      {finishedAt ? (
        <div className="reader-menu-in flex flex-col items-start">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm">
            <Check size={24} strokeWidth={3} />
          </span>
          <h2 className="font-serif type-3 text-balance mt-4 mb-0 text-[var(--reader-text)]">You finished {title}</h2>
          <p className="m-0 mt-1.5 text-[13px] font-medium text-[var(--reader-text-muted)]">
            {new Date(finishedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} · On
            your Shelf under Finished ·{" "}
            <button
              type="button"
              onClick={() => finish(false)}
              className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-bold text-[var(--reader-text-muted)] underline underline-offset-2 hover:text-[var(--reader-text)]"
            >
              Undo
            </button>
          </p>
        </div>
      ) : (
        <>
          <div className={eyebrow}>The end</div>
          <h2 className="font-serif type-3 text-balance mt-2 mb-0 text-[var(--reader-text)]">You&rsquo;ve reached the end of {title}</h2>
          {isAuthenticated && (
            <div className="mt-6 flex flex-col items-start gap-4 rounded-md border border-[var(--reader-border)] bg-[var(--reader-surface)] p-5">
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-bold text-[var(--reader-text)]">Did you finish it?</span>
                <span className="text-[13px] text-[var(--reader-text-muted)]">
                  Mark it finished and it moves to Finished on your Shelf.
                </span>
              </div>
              <button
                type="button"
                onClick={() => finish(true)}
                className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-sm border-none bg-brand-500 px-5 text-[14px] font-bold text-white transition-colors hover:bg-brand-600"
              >
                <Check size={16} strokeWidth={2.75} />
                Mark as finished
              </button>
            </div>
          )}
        </>
      )}

      {reflecting && (
        <div className="mt-10">
          <h3 className="m-0 mb-3 font-serif text-lg font-semibold text-[var(--reader-text)]">Share a note</h3>
          <NoteComposer
            initialText=""
            placeholder="Share a thought"
            showMemberPrompt
            action="note"
            draftKey={`finish-${materialId}`}
            onSave={(content, visibility) => {
              setNoteError(null);
              createNote.mutate(
                // No ranges: a closing reflection is about the material as a
                // whole, not a passage in it — the same general-note shape the
                // book-wide notes panel posts.
                { ranges: [], content, visibility },
                { onError: () => setNoteError("Couldn't save your note — check your connection and try again.") }
              );
            }}
          />
          {/* Same muted treatment FeedPanel gives its own composer
              error — reader chrome, not an alarm. */}
          {noteError && <p className="m-0 mt-2 text-[11px] text-[var(--reader-text-muted)]">{noteError}</p>}
        </div>
      )}

      {reflections.length > 0 && (
        <div className="mt-10 flex flex-col gap-4">
          <div className={eyebrow}>
            Notes · {reflections.length}
          </div>
          {reflections.map((n) => (
            <NoteBubble
              key={n.note.id}
              note={n}
              viewerId={viewerId}
              now={now}
              handlers={{
                onReact: (replyId) => viewerId && toggleReaction.mutate(replyId ?? n.note.id),
                onReply: viewerId
                  ? ({ text, mentions }, to) =>
                      createNote.mutate({ ranges: [], content: { kind: "text", text }, parentId: to ?? n.note.id, mentionReaderIds: mentions })
                  : undefined,
                onDelete: viewerId ? (replyId) => deleteNote.mutate(replyId ?? n.note.id) : undefined,
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

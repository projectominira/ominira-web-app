"use client";

import { useRouter } from "next/navigation";
import Loader from "@/app/components/Loader";
import NoResults from "@/app/components/shared/NoResults";
import { useNoteThread } from "@/lib/rooms/hooks";
import { useNow } from "@/lib/time/useNow";
import { useSessionStore } from "@/stores/session-store";
import NoteBubble from "./NoteBubble";
import { quoteReaderHref } from "./PassageQuote";
import RoomScreen, { ScreenHead } from "./RoomScreen";

/** A note and its replies on a page of their own (/note/[id]) — where a
 * notification lands, in app or pushed. The same bubble a room shows, with
 * every reply open: react, reply, delete (Remove for the group's
 * moderators) as there; the quote opens the reader at its passage. */
export default function NoteView({ noteId }: { noteId: string }) {
  const router = useRouter();
  const viewerId = useSessionStore((s) => s.readerId);
  const now = useNow();
  const back = () => (window.history.length > 1 ? router.back() : router.push("/home"));
  const { thread, heart, reply, del } = useNoteThread(noteId, back);
  const n = thread.data;
  const openPassage = () => {
    const href = n && quoteReaderHref(n);
    if (href) router.push(href);
  };

  return (
    <RoomScreen>
      <ScreenHead title="Note" subtitle={n?.material?.title ?? n?.note.group?.name ?? undefined} onBack={back} />
      <div className="om-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-[var(--color-app-canvas)]">
        <div className="mx-auto flex w-full flex-col px-4 pt-5 pb-12 shell:max-w-[560px]">
          {thread.isLoading ? (
            <div className="relative min-h-[240px]">
              <Loader confined />
            </div>
          ) : !n ? (
            <NoResults message="This note isn't available — it may have been deleted, or it's private." />
          ) : (
            <NoteBubble
              note={n}
              viewerId={viewerId}
              now={now}
              moderator={n.moderator}
              allReplies
              handlers={{
                onReact: (replyId) => viewerId && heart.mutate({ noteId: replyId ?? n.note.id, rootId: n.note.id }),
                onReply: viewerId ? (r, to) => void reply(n.note.id, r, to, n.note.ranges) : undefined,
                onDelete: viewerId ? (replyId) => del.mutate({ noteId: replyId ?? n.note.id, rootId: n.note.id }) : undefined,
              }}
              onPassage={openPassage}
            />
          )}
        </div>
      </div>
    </RoomScreen>
  );
}

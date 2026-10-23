"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Headphones } from "lucide-react";
import type { MaterialDetail } from "@/lib/materials/detail";
import { useMaterialReaction } from "@/lib/materials/useMaterialReaction";
import { resolveBookCoverSrc } from "@/lib/materials/image";
import { comradeName } from "@/lib/reader/authorDisplay";
import { pseudonymToSlug } from "@/lib/reader/profileSlug";
import { personName } from "@/lib/rooms/names";
import type { BookRoomHeader } from "@/lib/rooms/types";
import BookCover from "@/app/components/shared/BookCover";
import { useReadingPositionStore } from "@/stores/reading-position-store";
import ReaderAvatar from "@/app/components/shared/ReaderAvatar";
import ReactionButton from "@/app/components/reader/notes/ReactionButton";
import RoomAvatar from "@/app/components/rooms/RoomAvatar";
import { ResumeButtons } from "@/app/components/rooms/RoomHeader";
import ReadingProgress from "@/app/components/shared/ReadingProgress";
import { ScreenPage } from "@/app/components/rooms/RoomScreen";

// Book info, over the book's room: main's details page (the cover, title, author and
// facts, who added it, the description, your progress and the one resume
// button with the switch to the other mode), then who's reading now and the
// contents, each chapter read, or the one you're in.

const EYEBROW = "text-ui-xs tracking-eyebrow text-[var(--color-app-text-muted)] uppercase";
/** "webpage" never reaches this page; an unknown type is left out. */
const FORMAT_LABEL: Record<string, string> = { book: "EPUB", pdf: "PDF", docx: "Word document" };

export default function BookDetails({
  material,
  header: h,
  ready,
  onContinue,
  onSwitch,
  onChapter,
}: {
  material: MaterialDetail;
  header: BookRoomHeader;
  /** The server's reading position has landed: until then progress and the
   * resume button hold their place rather than resume from a stale one. */
  ready: boolean;
  onContinue: () => void;
  onSwitch: () => void;
  onChapter: (id: string) => void;
}) {
  const audiobook = material.narratorCount > 0;
  const position = useReadingPositionStore((s) => s.positions[material.id]);
  const setFinished = useReadingPositionStore((s) => s.setFinished);
  return (
    <ScreenPage>
      <div className="flex flex-col items-center gap-5 text-center">
        <BookCover materialType={material.materialType} src={resolveBookCoverSrc(material)} alt={material.title} className="aspect-[2/3] w-48 flex-none shadow-lg shell:w-56" />
        <div className="w-full min-w-0">
          <h1 className="m-0 font-serif type-1 text-balance text-[var(--reader-text)]">{material.title}</h1>
          <div className="mt-2 text-sm font-medium text-[var(--reader-text-muted)]">{material.author}</div>
          <MetaLine material={material} audiobook={audiobook} />
          <ContributorRow material={material} />
          {h.description && <Description text={h.description} />}

          {ready && h.pct !== null && <ReadingProgress chapter={h.chapter} pct={h.pct} className="mt-5" />}
          <div className="mt-5">
            <ResumeButtons header={h} audiobook={audiobook} ready={ready} onContinue={onContinue} onSwitch={onSwitch} />
          </div>
          {ready && position && (
            <button
              type="button"
              onClick={() => setFinished(material.id, !position.finishedAt)}
              className="mt-3 cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-[var(--reader-text-muted)] hover:underline"
            >
              {position.finishedAt ? "Mark as unfinished" : "Mark as finished"}
            </button>
          )}
        </div>
      </div>

      {h.everyone.length > 0 && (
        <section className="mt-10 flex flex-col">
          <h2 className={`m-0 pb-1 ${EYEBROW}`}>{h.everyoneCount} reading now</h2>
          {h.everyone.map(({ comrade }) => (
            <Link
              key={comrade.readerId}
              href={`/@${pseudonymToSlug(comrade.pseudonym)}`}
              className="-mx-2 flex min-h-12 items-center gap-3 rounded-sm px-2 no-underline hover:bg-sand-75"
            >
              <RoomAvatar comrade={comrade} size={30} />
              <span className="min-w-0 flex-1 truncate text-ui-sm font-bold text-[var(--color-app-text)]">{personName(comrade.pseudonym)}</span>
            </Link>
          ))}
          {h.everyoneCount > h.everyone.length && (
            <span className="pt-1.5 text-ui-caption font-bold text-[var(--color-app-text-muted)]">+{h.everyoneCount - h.everyone.length} more comrades</span>
          )}
        </section>
      )}

      {h.contents.length > 0 && (
        <section className="mt-10 flex flex-col">
          <h2 className={`m-0 pb-1 ${EYEBROW}`}>Contents</h2>
          {h.contents.map((c) => (
            <button
              key={c.num}
              type="button"
              onClick={() => c.id && onChapter(c.id)}
              className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-[var(--color-app-border)] py-1.5 text-left hover:bg-sand-75"
            >
              <span className="w-5 flex-none text-ui-caption text-[var(--color-app-text-muted)]">{c.num}</span>
              <span className="min-w-0 flex-1 text-ui-sm text-pretty">{c.label}</span>
              <ChapterMark pct={ready ? c.pct : null} />
            </button>
          ))}
        </section>
      )}
    </ScreenPage>
  );
}

/** Format, year, pages and the audiobook, as one quiet dot-separated line. */
function MetaLine({ material, audiobook }: { material: MaterialDetail; audiobook: boolean }) {
  const parts = [
    FORMAT_LABEL[material.materialType],
    material.publishedYear,
    material.pageCountEstimate && `${material.pageCountEstimate} pages`,
  ].filter(Boolean);
  if (!parts.length && !audiobook) return null;
  return (
    <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 text-[13px] font-medium text-[var(--reader-text-subtle)]">
      {parts.map((part, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden>·</span>}
          {part}
        </span>
      ))}
      {audiobook && (
        <span className="inline-flex items-center gap-2">
          {parts.length > 0 && <span aria-hidden>·</span>}
          <span className="inline-flex items-center gap-1 text-brand-500">
            <Headphones size={12} />
            Audiobook
          </span>
        </span>
      )}
    </div>
  );
}

/** "Added by {name}" with the thanks button, on a reader-contributed book. */
function ContributorRow({ material }: { material: MaterialDetail }) {
  const reaction = useMaterialReaction(material.id);
  const [reactedByMe, setReactedByMe] = useState(false);
  const [reactionCount, setReactionCount] = useState(material.reactionCount);
  if (!material.contributor) return null;
  const profileHref = `/@${pseudonymToSlug(material.contributor.pseudonym)}`;

  const onToggle = () => {
    const was = reactedByMe;
    setReactedByMe(!was);
    setReactionCount((c) => c + (was ? -1 : 1));
    reaction.mutate(undefined, {
      onError: () => {
        setReactedByMe(was);
        setReactionCount((c) => c + (was ? 1 : -1));
      },
      onSuccess: (data) => {
        setReactedByMe(data.reactedByMe);
        setReactionCount(data.reactionCount);
      },
    });
  };

  return (
    <div className="mt-6 flex items-center gap-3 border-y border-[var(--reader-border)] py-3.5 text-left">
      <Link href={profileHref} className="flex flex-none no-underline">
        <ReaderAvatar pseudonym={material.contributor.pseudonym} avatar={material.contributor.avatar} size={32} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-[var(--reader-text-subtle)]">Added by</div>
        <Link href={profileHref} className="truncate text-[13px] font-semibold text-[var(--reader-text)] no-underline hover:underline">
          {comradeName(material.contributor.pseudonym)}
        </Link>
      </div>
      <ReactionButton count={reactionCount} reacted={reactedByMe} onToggle={onToggle} size="small" />
    </div>
  );
}

/** Cut to six lines with Show more only when it really is cut: measured,
 * since a character count is wrong both ways. Left-aligned: centred prose
 * reads badly. */
function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  // Measured while clamped; the toggle doesn't re-run it.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setCut(el.scrollHeight > el.clientHeight + 1);
  }, [text]);
  return (
    <div className="mt-4 text-left">
      <p ref={ref} className={`m-0 text-sm leading-6 font-medium text-[var(--reader-text-muted)] ${open ? "" : "line-clamp-6"}`}>
        {text}
      </p>
      {cut && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 cursor-pointer border-none bg-transparent p-0 text-sm font-semibold text-brand-500 hover:underline">
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

/** A chapter read (a tick), part read (its percentage), or not reached. */
function ChapterMark({ pct }: { pct: number | null }) {
  if (pct === 100)
    return (
      <span className="flex size-5.5 flex-none items-center justify-center rounded-full bg-brand-500 text-sand-25">
        <Check size={13} strokeWidth={2.5} aria-hidden />
      </span>
    );
  // The chapter you're in, not a percentage: the bar above is the book's.
  if (pct) return <span className="flex-none font-sans text-[12px]/none font-bold text-[var(--color-app-brand)]">Reading</span>;
  return <span className="size-5.5 flex-none rounded-full border-[1.5px] border-sand-300" />;
}

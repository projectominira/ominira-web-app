import ReaderLink from "@/app/components/ReaderLink";
import type { HomePassage } from "@/lib/rooms/types";
import PassageQuote from "@/app/components/rooms/PassageQuote";

/** The passage of the day on Home (home-spec §2 Home 3): the eyebrow with
 * how many answered, the question, and the quote, which opens the reader. */
export default function PassageCard({ passage }: { passage: HomePassage }) {
  return (
    <div className="flex flex-col gap-3 rounded-sm border border-[var(--color-app-border)] bg-[var(--reader-bg)] p-5 text-[var(--color-app-text)]">
      <div className="flex items-center justify-between gap-2 text-ui-xs tracking-eyebrow uppercase text-[var(--color-app-text-muted)]">
        <span>Passage of the day</span>
        {passage.answers > 0 && <span>{passage.answers} {passage.answers === 1 ? "answer" : "answers"}</span>}
      </div>
      <div className="font-serif text-[21px]/[1.25] font-semibold">{passage.question}</div>
      <ReaderLink href={passage.href} className="block">
        <PassageQuote excerpt={passage.excerpt} cite={passage.cite} />
      </ReaderLink>
    </div>
  );
}

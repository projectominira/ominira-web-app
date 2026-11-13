import ForYou from "@/app/components/home/ForYou";
import QuoteShare from "@/app/components/quotes/QuoteShare";
import type { BookExtras as Extras } from "@/lib/materials/extras";

// Below a book's contents: all its quotes (the directory's cards, without
// the book they're all from), then related books in one swiped row (Home's
// For you shelf), the author's own first.

const EYEBROW = "m-0 text-ui-xs tracking-eyebrow text-[var(--color-app-text-muted)] uppercase";

export default function BookExtras({ extras, title, author }: { extras: Extras; title: string; author: string }) {
  return (
    <>
      {extras.quotes.length > 0 && (
        <section className="mt-10 flex flex-col gap-3">
          <h2 className={EYEBROW}>Quotes</h2>
          {extras.quotes.map((q) => (
            <article key={q.id} className="flex items-start gap-3 rounded-sm border border-[var(--color-app-border)] p-4 pr-2">
              <p className="m-0 min-w-0 flex-1 font-serif text-[15px]/[1.65] text-pretty text-[var(--color-app-text)]">“{q.text}”</p>
              <QuoteShare text={q.text} title={title} author={author} />
            </article>
          ))}
        </section>
      )}
      {extras.related.length > 0 && (
        <div className="mt-10">
          <ForYou books={extras.related} title="Related books" titleClassName={EYEBROW} />
        </div>
      )}
    </>
  );
}

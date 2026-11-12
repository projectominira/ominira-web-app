import Link from "next/link";
import { ChevronRight } from "lucide-react";
import SearchableAppPage from "@/app/components/shell/SearchableAppPage";
import ShareButton from "@/app/components/materials/ShareButton";
import { Cover } from "@/app/components/quotes/QuotesDirectory";
import JoinBar from "@/app/components/authors/JoinBar";
import { PLATFORM_NAME, PLATFORM_URL } from "@/lib/config/platform";
import { resolveBookThumbnailSrc } from "@/lib/materials/image";
import { liveAt, monthLabel, type ListedReadingList, type ReadingListPage } from "@/lib/readingLists/lists";
import { breadcrumbs, JsonLd } from "@/lib/seo/jsonLd";

// A monthly reading list (seo-spec.md C1), as Claude Design "SEO content
// pages" → Reading List.dc.html: the 720px editorial column, the answer-first
// introduction, a strip of covers, the numbered books with a note each and a
// quote under some, "Go deeper" to the topic page, and more lists. Below
// 900px (the design's breakpoint) the numbers go and the covers shrink.

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const dateLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const LINK = "text-[var(--color-app-brand)] no-underline hover:text-brand-600 hover:underline";
const H2 = "m-0 font-serif text-[24px]/[1.25] font-semibold text-[var(--color-app-text)]";
const META = "text-[13px]/[1.4] font-medium text-[var(--color-app-text-secondary)]";
const EYEBROW = "text-[11px] font-bold tracking-eyebrow uppercase";

/** A card in "More reading lists" (also the hub's rows). */
export function ListCard({ l }: { l: ListedReadingList }) {
  return (
    <Link
      href={`/reading-lists/${l.slug}`}
      className="flex flex-col gap-2 rounded-sm border border-[var(--color-app-border)] p-[18px] text-[var(--color-app-text)] no-underline hover:border-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-muted)]"
    >
      <span className={`${EYEBROW} text-[var(--color-app-text-muted)]`}>{monthLabel(l.day)}</span>
      <span className="font-serif text-[18px]/[1.3] font-semibold">{l.title}</span>
      <span className={META}>{plural(l.books, "book")}</span>
    </Link>
  );
}

export default function ReadingListView({ l }: { l: ReadingListPage }) {
  const path = `/reading-lists/${l.slug}`;
  const url = `${PLATFORM_URL}${path}`;
  const month = monthLabel(l.day);
  const paras = l.intro.split(/\n\s*\n/);

  // schema.org: an Article whose main entity is the books as an ItemList.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: l.title,
    name: l.title,
    url,
    description: paras[0],
    datePublished: liveAt(l.day),
    dateModified: l.updatedAt > liveAt(l.day) ? l.updatedAt : liveAt(l.day),
    author: { "@type": "Organization", name: `${PLATFORM_NAME} editors`, url: PLATFORM_URL },
    publisher: { "@id": `${PLATFORM_URL}/#organization` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: l.entries.length,
      itemListElement: l.entries.map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: { "@type": "Book", name: e.book.title, author: { "@type": "Person", name: e.book.author }, url: `${PLATFORM_URL}/library/${e.book.slug}` },
      })),
    },
    ...(l.entries.some((e) => e.quote) && {
      hasPart: l.entries.flatMap((e) =>
        e.quote ? [{ "@type": "Quotation", text: e.quote.text, creator: { "@type": "Person", name: e.book.author }, isPartOf: { "@type": "Book", name: e.book.title, url: `${PLATFORM_URL}/library/${e.book.slug}` } }] : []
      ),
    }),
  };

  return (
    <SearchableAppPage className="pb-20">
      <JsonLd data={[jsonLd, breadcrumbs([["Reading lists", "/reading-lists"], [l.title, path]])]} />
      <article className="mx-auto flex max-w-[720px] flex-col gap-[22px]">
        <nav className="flex items-center gap-2 pt-2 text-[13px]/none font-medium text-[var(--color-app-text-muted)]">
          <Link href="/reading-lists" className="text-inherit no-underline hover:underline">Reading lists</Link>
          <span>/</span>
          <span>{month}</span>
        </nav>

        <div className="flex flex-col gap-3.5 pt-1.5">
          <span className={`${EYEBROW} text-[var(--color-app-brand)]`}>Reading list · {month}</span>
          <h1 className="m-0 font-serif text-[32px]/[1.12] font-semibold tracking-[-0.01em] text-balance text-[var(--color-app-text)] min-[900px]:text-[44px]/[1.12]">{l.title}</h1>
        </div>
        {paras.map((p, i) => (
          <p key={i} className={`m-0 font-serif text-[17px]/[1.65] text-pretty text-[var(--color-app-text)] min-[900px]:text-[19px]/[1.65] ${i > 0 ? "-mt-2" : ""}`}>
            {p}
          </p>
        ))}
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[13px]/[1.4] font-medium text-[var(--color-app-text-secondary)]">
          <span>{PLATFORM_NAME} editors</span>
          <span aria-hidden className="size-[3px] rounded-full bg-[var(--color-app-text-muted)]" />
          <span>{dateLabel(l.day)}</span>
          <span aria-hidden className="size-[3px] rounded-full bg-[var(--color-app-text-muted)]" />
          <span>{plural(l.entries.length, "book")}</span>
          <ShareButton
            title={l.title}
            text={`${l.title}, on ${PLATFORM_NAME}.`}
            ariaLabel="Share this list"
            labelClassName="hidden min-[900px]:inline"
            className="ml-auto flex h-[34px] cursor-pointer items-center gap-1.5 rounded-sm border border-[var(--color-app-border)] bg-transparent px-3 text-[13px] font-medium text-[var(--color-app-text)] hover:bg-[var(--color-app-surface-muted)]"
          />
        </div>
        <div aria-hidden className="flex pl-2.5">
          {l.entries.map((e) => (
            <Cover key={e.book.id} src={resolveBookThumbnailSrc(e.book)} className="-ml-2.5 h-[63px] w-[42px] border-2 border-[var(--color-app-surface)] min-[900px]:h-20 min-[900px]:w-[54px]" />
          ))}
        </div>

        <div className="mt-2.5 flex flex-col">
          {l.entries.map((e, i) => {
            const href = `/library/${e.book.slug}`;
            return (
              <section
                key={e.book.id}
                className="grid grid-cols-[72px_minmax(0,1fr)] gap-3.5 border-t border-[var(--color-app-border)] py-7 min-[900px]:grid-cols-[44px_96px_minmax(0,1fr)] min-[900px]:gap-5"
              >
                <span className="hidden pt-1 font-serif text-[22px]/none font-semibold text-[var(--color-app-brand)] min-[900px]:block">{String(i + 1).padStart(2, "0")}</span>
                <Link href={href} tabIndex={-1} aria-hidden>
                  <Cover src={resolveBookThumbnailSrc(e.book)} className="h-[108px] w-[72px] min-[900px]:h-36 min-[900px]:w-24" />
                </Link>
                <div className="flex min-w-0 flex-col gap-2">
                  {e.tag && <span className={`${EYEBROW} self-start rounded-[3px] bg-brand-500/10 px-2 py-[5px] text-[var(--color-app-brand)]`}>{e.tag}</span>}
                  <h2 className="m-0 font-serif text-[20px]/[1.3] font-semibold">
                    <Link href={href} className="text-[var(--color-app-text)] no-underline hover:underline">{e.book.title}</Link>
                  </h2>
                  <span className={META}>{[e.book.author, e.book.publishedYear].filter(Boolean).join(" · ")}</span>
                  <p className="m-0 text-[15px]/[1.65] text-pretty text-[var(--color-app-text-secondary)]">{e.why}</p>
                  <Link href={href} className={`inline-flex items-center gap-1.5 text-[14px]/none font-semibold ${LINK}`}>
                    Read on {PLATFORM_NAME}
                    <ChevronRight size={16} aria-hidden />
                  </Link>
                </div>
                {e.quote && (
                  <blockquote className="col-span-full m-0 mt-1.5 flex flex-col gap-3 border-l-2 border-brand-300 py-1 pl-5 min-[900px]:col-start-3 min-[900px]:-mt-1">
                    <p className="m-0 font-serif text-[19px]/[1.55] text-pretty text-[var(--color-app-text)] min-[900px]:text-[22px]/[1.55]">“{e.quote.text}”</p>
                    <cite className={`not-italic ${META}`}>
                      {e.book.author},{" "}
                      <Link href={href} className={`font-semibold ${LINK}`}>{e.book.title}</Link>
                    </cite>
                  </blockquote>
                )}
              </section>
            );
          })}
        </div>

        {l.deeper && (
          <Link
            href={`/topics/${l.deeper.slug}`}
            className="grid grid-cols-1 items-center gap-4 rounded-sm border border-[var(--color-app-border)] bg-[var(--color-app-surface-muted)] p-[22px] no-underline hover:border-[var(--color-app-text-muted)] min-[900px]:grid-cols-[minmax(0,1fr)_auto]"
          >
            <div className="flex flex-col gap-1.5">
              <span className={`${EYEBROW} text-[var(--color-app-text-muted)]`}>Go deeper</span>
              <span className="font-serif text-[20px]/[1.3] font-semibold text-[var(--color-app-text)]">{l.deeper.title}</span>
              <span className={META}>{plural(l.deeper.books, "book")} on the topic, in reading order</span>
            </div>
            {l.deeper.covers.length > 0 && (
              <div aria-hidden className="flex gap-1.5">
                {l.deeper.covers.map((c) => (
                  <Cover key={c} src={c} className="h-[60px] w-10" />
                ))}
              </div>
            )}
          </Link>
        )}

        {l.more.length > 0 && (
          <section className="mt-[18px] flex flex-col gap-3.5">
            <h2 className={H2}>More reading lists</h2>
            <div className="grid grid-cols-1 gap-3.5 min-[900px]:grid-cols-3">
              {l.more.map((m) => (
                <ListCard key={m.slug} l={m} />
              ))}
            </div>
          </section>
        )}

        <JoinBar editorial>Read these books with comrades: notes on every page, and an African voice to listen in.</JoinBar>
      </article>
    </SearchableAppPage>
  );
}

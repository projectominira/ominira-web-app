import Link from "next/link";
import type { MaterialSummary } from "@/lib/api/types";
import SearchableAppPage from "@/app/components/shell/SearchableAppPage";
import PillScrollRow from "@/app/components/shell/PillScrollRow";
import { Cover } from "@/app/components/quotes/QuotesDirectory";
import JoinBar from "@/app/components/authors/JoinBar";
import { PLATFORM_NAME, PLATFORM_URL } from "@/lib/config/platform";
import { breadcrumbs, JsonLd } from "@/lib/seo/jsonLd";
import { resolveBookThumbnailSrc } from "@/lib/materials/image";
import type { DirectoryQuote } from "@/lib/quotes/directory";
import { ALL_SHOWN, type TopicPage } from "@/lib/topics/guides";
import ShowAll from "./ShowAll";

// A topic page (seo-spec.md C3), exactly as Claude Design "SEO content
// pages" → Topic.dc.html: a 720px editorial column with the answer-first
// introduction, the reading path in numbered stages with a quote woven into
// each, related authors and topics, and for a category every book in it.
// Below 900px (the design's breakpoint) it folds to one column.

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

const LINK = "text-[var(--color-app-brand)] no-underline hover:text-brand-600 hover:underline";
const H2 = "m-0 text-ui-md font-bold text-[var(--color-app-text)]";
const NOTE = "m-0 text-[13px]/[1.5] text-pretty text-[var(--color-app-text-secondary)]";
const META = "text-ui-sm text-[var(--color-app-text-secondary)]";
const RULE = "m-0 h-px border-0 bg-[var(--color-app-border)]";

function Related({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  if (links.length === 0) return null;
  return (
    <div className="min-[900px]:max-w-64">
      <h3 className="m-0 mb-2.5 text-ui-xs font-bold tracking-eyebrow text-[var(--color-app-text-muted)] uppercase">{title}</h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-ui-body">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className={LINK}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A book on the reading path: cover, title, author and why it is here. */
function PathItem({ book, why }: { book: MaterialSummary; why: string }) {
  return (
    <Link
      href={`/library/${book.slug}`}
      className="group grid grid-cols-[80px_minmax(0,1fr)] gap-4 border-t border-[var(--color-app-border)] py-4 text-[var(--color-app-text)] no-underline"
    >
      <Cover src={resolveBookThumbnailSrc(book)} className="h-28 w-20" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="font-serif text-[14px] font-semibold leading-tight group-hover:text-[var(--color-app-brand)]">{book.title}</span>
        <span className="text-[11px] font-semibold capitalize tracking-[0.04em] text-[var(--color-app-text-muted)]">{book.author}</span>
        <p className={NOTE}>{why}</p>
      </div>
    </Link>
  );
}

/** A stage's quote, woven in under its books. */
function Woven({ quote: q }: { quote: DirectoryQuote }) {
  return (
    <blockquote className="mx-0 mt-[18px] mb-2.5 flex flex-col gap-3 border-l-2 border-brand-300 py-1 pl-5 min-[900px]:ml-14">
      <p className="m-0 font-serif text-[15px]/[1.65] text-pretty text-[var(--color-app-text)]">“{q.text}”</p>
      <cite className={`not-italic ${META}`}>
        {q.book.author},{" "}
        <Link href={`/library/${q.book.slug}`} className={`font-semibold ${LINK}`}>
          {q.book.title}
        </Link>
      </cite>
    </blockquote>
  );
}

/** A row in "All N books". */
function AllRow({ book }: { book: MaterialSummary }) {
  return (
    <Link
      href={`/library/${book.slug}`}
      className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3.5 border-t border-[var(--color-app-border)] py-3 text-[var(--color-app-text)] no-underline"
    >
      <Cover src={resolveBookThumbnailSrc(book)} className="h-[72px] w-12" />
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="font-serif text-[14px] font-semibold leading-tight">{book.title}</span>
        <span className="text-[11px] font-semibold capitalize tracking-[0.04em] text-[var(--color-app-text-muted)]">{book.author}</span>
      </div>
    </Link>
  );
}

export default function TopicPageView({ t, lists = [] }: { t: TopicPage; /** Monthly reading lists on this topic (seo-spec C1). */ lists?: { slug: string; title: string }[] }) {
  const url = `${PLATFORM_URL}/topics/${t.slug}`;
  const pathCount = t.stages.reduce((n, s) => n + s.books.length, 0);
  const count = t.category ? t.all.length : pathCount;
  const allTitle = `All ${plural(t.all.length, "book")} on ${t.name}`;

  // schema.org: the reading path as an ItemList (or the category's books),
  // its woven quotes as Quotations, and the breadcrumbs.
  const listed = t.stages.length ? t.stages.flatMap((s) => s.books.map((b) => b.book)) : t.all;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": t.stages.length ? "Article" : "CollectionPage",
    headline: t.title,
    name: t.title,
    url,
    ...(t.intro && { description: t.intro.split(/\n\s*\n/)[0] }),
    ...(t.approvedAt && { dateModified: t.approvedAt, author: { "@type": "Organization", name: `${PLATFORM_NAME} editors`, url: PLATFORM_URL } }),
    about: t.name,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: listed.length,
      itemListElement: listed.map((b, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: { "@type": "Book", name: b.title, author: { "@type": "Person", name: b.author }, url: `${PLATFORM_URL}/library/${b.slug}` },
      })),
    },
    ...(t.stages.some((s) => s.quote) && {
      hasPart: t.stages.flatMap((s) =>
        s.quote
          ? [{ "@type": "Quotation", text: s.quote.text, creator: { "@type": "Person", name: s.quote.book.author }, isPartOf: { "@type": "Book", name: s.quote.book.title, url: `${PLATFORM_URL}/library/${s.quote.book.slug}` } }]
          : []
      ),
    }),
  };

  const paras = t.intro ? t.intro.split(/\n\s*\n/) : [`Every book on ${t.name} in the ${PLATFORM_NAME} library, to read or listen to.`];

  return (
    <SearchableAppPage className="pb-20">
      <JsonLd data={[jsonLd, breadcrumbs([["Topics", "/topics"], [t.name, `/topics/${t.slug}`]])]} />
      <article className="flex flex-col gap-[22px]">
        <nav className="flex items-center gap-2 pt-2 text-ui-sm text-[var(--color-app-text-muted)]">
          <Link href="/library" className="text-inherit no-underline hover:underline">Library</Link>
          <span>/</span>
          <Link href="/topics" className="text-inherit no-underline hover:underline">Topics</Link>
          <span>/</span>
          <span>{t.name}</span>
        </nav>

        <div className="flex flex-col gap-3.5 pt-1.5">
          <span className="text-ui-xs font-bold tracking-eyebrow text-[var(--color-app-brand)] uppercase">Topic · {plural(count, "book")}</span>
          <h1 className="m-0 text-display-sm text-pretty text-[var(--color-app-text)]">{t.title}</h1>
        </div>
        {paras.map((p, i) => (
          <p key={i} className={`m-0 text-reading-sm text-pretty text-[var(--color-app-text)] ${i > 0 ? "-mt-2" : ""}`}>
            {p}
          </p>
        ))}
        {t.approvedAt && (
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-ui-sm text-[var(--color-app-text-secondary)]">
            <span>Project {PLATFORM_NAME}</span>
            <span aria-hidden className="size-[3px] rounded-full bg-[var(--color-app-text-muted)]" />
            <span>{dateLabel(t.approvedAt)}</span>
          </div>
        )}

        {t.stages.length > 0 && (
          <nav aria-label="Sections">
            <PillScrollRow
              items={[
                ...t.stages.map((s, i) => ({ key: `stage-${i + 1}`, label: `${i + 1} · ${s.title}`, active: false, href: `#stage-${i + 1}` })),
                ...(t.all.length > 0 ? [{ key: "all", label: `All ${t.all.length} books`, active: false, href: "#all" }] : []),
              ]}
            />
          </nav>
        )}

        {t.stages.map((s, i) => (
          <section key={s.title} id={`stage-${i + 1}`} className="flex scroll-mt-20 flex-col gap-1.5 pt-3">
            <div className="grid grid-cols-[34px_minmax(0,1fr)] items-baseline gap-3 pb-1.5 min-[900px]:grid-cols-[44px_minmax(0,1fr)]">
              <span className="font-serif text-[19px]/none font-semibold text-[var(--color-app-brand)] min-[900px]:text-[22px]/none">{i + 1}</span>
              <div className="flex flex-col gap-1.5">
                <h2 className={H2}>{s.title}</h2>
                <p className={NOTE}>{s.intro}</p>
              </div>
            </div>
            {s.books.map(({ book, why }) => (
              <PathItem key={book.id} book={book} why={why} />
            ))}
            {s.quote && <Woven quote={s.quote} />}
          </section>
        ))}

        {(t.authors.length > 0 || t.related.length > 0 || lists.length > 0) && (
          <>
            <hr className={`${RULE} ${t.stages.length ? "mt-[18px]" : ""}`} />
            <section className="flex flex-col items-center gap-6 text-center min-[900px]:flex-row min-[900px]:items-start min-[900px]:justify-center min-[900px]:gap-16">
              <Related title="Authors" links={t.authors.map((a) => ({ href: `/authors/${a.slug}`, label: a.name }))} />
              <Related title="Related topics" links={t.related.map((r) => ({ href: `/topics/${r.slug}`, label: r.name }))} />
              <Related title="Reading lists" links={lists.map((l) => ({ href: `/reading-lists/${l.slug}`, label: l.title }))} />
            </section>
          </>
        )}

        {t.all.length > 0 && (
          <>
            <hr className={`${RULE} mt-2.5`} />
            <section id="all" className="flex scroll-mt-20 flex-col gap-3.5">
              <h2 className={H2}>{t.stages.length ? allTitle : `${plural(t.all.length, "book")} on ${t.name}`}</h2>
              <div className="grid grid-cols-1 min-[900px]:grid-cols-2 min-[900px]:gap-x-8">
                {t.all.slice(0, ALL_SHOWN).map((b) => (
                  <AllRow key={b.id} book={b} />
                ))}
                {t.all.length > ALL_SHOWN && (
                  <ShowAll total={t.all.length}>
                    {t.all.slice(ALL_SHOWN).map((b) => (
                      <AllRow key={b.id} book={b} />
                    ))}
                  </ShowAll>
                )}
              </div>
            </section>
          </>
        )}

        <JoinBar editorial />
      </article>
    </SearchableAppPage>
  );
}

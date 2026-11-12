import Link from "next/link";
import SearchableAppPage from "@/app/components/shell/SearchableAppPage";
import ShareButton from "@/app/components/materials/ShareButton";
import type { AuthorBook, AuthorPage } from "@/lib/authors/authors";
import { slugifyCategory } from "@/lib/categories/slug";
import { PLATFORM_NAME, PLATFORM_URL } from "@/lib/config/platform";
import JoinBar from "./JoinBar";

// An author page (seo-spec.md C2; Claude Design "SEO content pages" →
// Author.dc.html): name and facts, the approved bio with its sources, their
// books, a few quotes, books to read alongside, and their topics.

export const lifespan = (a: { born: number | null; died: number | null }) =>
  a.born && a.died ? `${a.born}–${a.died}` : a.born ? `Born ${a.born}` : a.died ? `Died ${a.died}` : null;

const rule = <hr className="m-0 h-px border-0 bg-[var(--color-app-border)]" />;
const h2 = "m-0 font-serif text-[22px]/[1.25] font-semibold text-[var(--color-app-text)] md:text-[24px]";

function Cover({ src, className }: { src: string | null; className: string }) {
  return (
    <span className={`block flex-none overflow-hidden rounded-[3px] bg-[var(--color-app-surface-muted)] shadow-[0_1px_2px_rgba(20,17,14,.12)] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt="" loading="lazy" className="block size-full object-cover" />}
    </span>
  );
}

function Book({ book }: { book: AuthorBook }) {
  return (
    <Link href={`/library/${book.slug}`} className="group flex flex-col gap-2 text-[var(--color-app-text)] no-underline md:gap-2.5">
      <Cover src={book.cover} className="aspect-[2/3] w-full" />
      <span className="font-serif text-[14px]/[1.3] font-semibold group-hover:text-[var(--color-app-brand)] md:text-[18px]">{book.title}</span>
    </Link>
  );
}

export default function AuthorPageView({ a }: { a: AuthorPage }) {
  const url = `${PLATFORM_URL}/authors/${a.slug}`;
  const facts = [lifespan(a), a.role, a.places].filter(Boolean) as string[];
  // schema.org Person, linked to Wikidata/Wikipedia, with their books.
  const wikipedia = a.sources.find((s) => /wikipedia\.org/.test(s.url))?.url;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    name: `${a.name}: books and quotes`,
    ...(a.approvedAt && { dateModified: a.approvedAt }),
    mainEntity: {
      "@type": "Person",
      name: a.name,
      url,
      ...(a.bio && { description: a.bio }),
      ...(a.role && { jobTitle: a.role }),
      ...(a.born && { birthDate: String(a.born) }),
      ...(a.died && { deathDate: String(a.died) }),
      sameAs: [a.wikidataId && `https://www.wikidata.org/wiki/${a.wikidataId}`, wikipedia].filter(Boolean),
      subjectOf: a.books.map((b) => ({ "@type": "Book", name: b.title, url: `${PLATFORM_URL}/library/${b.slug}` })),
    },
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Authors", item: `${PLATFORM_URL}/authors` },
      { "@type": "ListItem", position: 2, name: a.name, item: url },
    ],
  };

  return (
    <SearchableAppPage className="pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, breadcrumbs]).replace(/</g, "\\u003c") }} />
      <article className="mx-auto flex max-w-[720px] flex-col gap-[22px]">
        <nav className="flex items-center gap-2 pt-2 text-[13px] font-medium text-[var(--color-app-text-muted)]">
          <Link href="/authors" className="text-inherit">Authors</Link>
          <span>/</span>
          <span>{a.name}</span>
        </nav>

        <header className="flex flex-col gap-3 pt-1.5">
          <span className="text-[11px] font-bold tracking-eyebrow text-[var(--color-app-brand)] uppercase">Author</span>
          <h1 className="m-0 font-serif text-[32px]/[1.12] font-semibold tracking-[-0.01em] text-balance text-[var(--color-app-text)] md:text-[44px]">{a.name}</h1>
          {facts.length > 0 && (
            <p className="m-0 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[14px]/[1.4] font-medium text-[var(--color-app-text-secondary)]">
              {facts.map((f, i) => (
                <span key={f} className="contents">
                  {i > 0 && <span aria-hidden>·</span>}
                  <span>{f}</span>
                </span>
              ))}
            </p>
          )}
        </header>

        {a.bio && <p className="m-0 font-serif text-[17px]/[1.65] text-pretty whitespace-pre-line text-[var(--color-app-text)] md:text-[19px]">{a.bio}</p>}

        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          {a.sources.length > 0 && (
            <span className="text-[12px]/[1.4] font-medium text-[var(--color-app-text-muted)]">
              Sources:{" "}
              {a.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && ", "}
                  <a href={s.url} rel="nofollow noopener" target="_blank" className="text-inherit underline">
                    {s.title}
                  </a>
                </span>
              ))}
            </span>
          )}
          <span className="ml-auto">
            <ShareButton title={`${a.name} on ${PLATFORM_NAME}`} text={`Books and quotes by ${a.name} on ${PLATFORM_NAME}.`} ariaLabel="Share this page" />
          </span>
        </div>

        {rule}
        <section className="flex flex-col gap-[18px]">
          <h2 className={h2}>Books by {a.name} on Ominira</h2>
          <div className="grid grid-cols-3 gap-3 md:gap-6">
            {a.books.map((b) => (
              <Book key={b.slug} book={b} />
            ))}
          </div>
        </section>

        {a.quotes.length > 0 && (
          <>
            {rule}
            <section className="flex flex-col gap-6">
              <h2 className={h2}>Quotes</h2>
              <div className="flex flex-col gap-8">
                {a.quotes.map((q) => (
                  <blockquote key={q.id} className="m-0 flex flex-col gap-3 border-l-2 border-brand-300 py-1 pl-5">
                    <p className="m-0 font-serif text-[19px]/[1.55] text-pretty text-[var(--color-app-text)] md:text-[22px]">“{q.text}”</p>
                    <cite className="text-[13px]/[1.4] font-medium not-italic text-[var(--color-app-text-secondary)]">
                      <Link href={`/library/${q.book.slug}`} className="font-semibold">
                        {q.book.title}
                      </Link>
                    </cite>
                  </blockquote>
                ))}
              </div>
              {a.moreQuotes && (
                <Link href={`/quotes/${a.slug}`} className="text-[14px] font-semibold text-[var(--color-app-brand)]">
                  All quotes by {a.name}
                </Link>
              )}
            </section>
          </>
        )}

        {a.alongside.length > 0 && (
          <>
            {rule}
            <section className="flex flex-col">
              <h2 className={`${h2} mb-4`}>Read alongside {a.name}</h2>
              {a.alongside.map((b) => (
                <Link
                  key={b.slug}
                  href={`/library/${b.slug}`}
                  className="group grid grid-cols-[56px_minmax(0,1fr)] items-center gap-4 border-t border-[var(--color-app-border)] py-3.5 text-[var(--color-app-text)] no-underline"
                >
                  <Cover src={b.cover} className="h-[84px] w-14" />
                  <span className="flex flex-col gap-1">
                    <span className="font-serif text-[17px]/[1.3] font-semibold group-hover:text-[var(--color-app-brand)]">{b.title}</span>
                    <span className="text-[13px]/[1.4] font-medium text-[var(--color-app-text-secondary)]">{b.author}</span>
                    <span className="text-[14px]/[1.65] text-pretty text-[var(--color-app-text-secondary)]">{b.why}</span>
                  </span>
                </Link>
              ))}
            </section>
          </>
        )}

        {a.topics.length > 0 && (
          <section className="mt-3.5 flex flex-col gap-3">
            <span className="text-[11px] font-bold tracking-eyebrow text-[var(--color-app-text-muted)] uppercase">Topics</span>
            <div className="flex flex-wrap gap-2">
              {a.topics.map((t) => (
                <Link
                  key={t}
                  href={`/library?q=${slugifyCategory(t)}`}
                  className="flex h-[34px] items-center rounded-sm border border-[var(--color-app-border)] px-3.5 text-[13px] font-medium text-[var(--color-app-text)] no-underline hover:bg-[var(--color-app-surface-muted)]"
                >
                  {t}
                </Link>
              ))}
            </div>
          </section>
        )}

        <JoinBar>Read {a.name} with comrades: notes on every page, and an African voice to listen in.</JoinBar>
      </article>
    </SearchableAppPage>
  );
}

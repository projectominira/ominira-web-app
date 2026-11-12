import Link from "next/link";
import SearchableAppPage from "@/app/components/shell/SearchableAppPage";
import BookListRow from "@/app/components/shell/BookListRow";
import ShareButton from "@/app/components/materials/ShareButton";
import { Chip, QuoteCard } from "@/app/components/quotes/QuotesDirectory";
import { lifespan, type AuthorPage } from "@/lib/authors/authors";
import { slugifyCategory } from "@/lib/categories/slug";
import { PLATFORM_NAME, PLATFORM_URL } from "@/lib/config/platform";
import JoinBar from "./JoinBar";

// An author page (seo-spec.md C2; Claude Design "SEO content pages" →
// Author.dc.html), in the app shell's own frame and type: the quote
// directory's header and quote cards, the library's book rows. Name and
// facts, the approved bio with its sources, their books, a few quotes,
// books to read alongside, and their topics.

/** An author's portrait (Wikimedia Commons), or their initials. */
export function Portrait({ src, name, className }: { src: string | null; name: string; className: string }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^\p{Lu}/u.test(w))
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return (
    <span className={`flex flex-none items-center justify-center overflow-hidden rounded-full bg-[var(--color-app-surface-muted)] font-serif text-[15px] font-semibold text-[var(--color-app-text-muted)] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={name} loading="lazy" className="block size-full object-cover object-top" /> : initials}
    </span>
  );
}

/** A section under the header, titled as the quote directory's "Quotes by
 * author". Set apart by space, not a rule: book rows carry their own. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 pt-6">
      <h2 className="m-0 text-ui-md font-bold text-[var(--color-app-text)]">{title}</h2>
      {children}
    </section>
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
      ...(a.image && { image: a.image }),
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
      <article className="mx-auto flex max-w-[980px] flex-col gap-5">
        <nav className="flex items-center gap-2 pt-2 text-[13px] font-medium text-[var(--color-app-text-muted)]">
          <Link href="/authors" className="text-inherit">Authors</Link>
          <span>/</span>
          <span>{a.name}</span>
        </nav>

        <header className="flex max-w-[720px] flex-col gap-3">
          <div className="flex items-center gap-4 md:gap-5">
            {a.image && <Portrait src={a.image} name={a.name} className="size-20 md:size-24" />}
            <div className="flex min-w-0 flex-col gap-2">
              <span className="text-[11px] font-bold tracking-eyebrow text-[var(--color-app-brand)] uppercase">Author</span>
              <h1 className="m-0 font-serif text-[24px]/[1.25] font-semibold text-balance md:text-[28px]/[1.2] text-[var(--color-app-text)]">{a.name}</h1>
              {facts.length > 0 && (
                <p className="m-0 flex flex-wrap gap-x-2 gap-y-1 text-[13px]/[1.4] font-medium text-[var(--color-app-text-muted)]">
                  {facts.map((f, i) => (
                    <span key={f} className="contents">
                      {i > 0 && <span aria-hidden>·</span>}
                      <span>{f}</span>
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>
          {a.bio && <p className="m-0 text-[15px]/[1.6] text-pretty whitespace-pre-line text-[var(--color-app-text-secondary)]">{a.bio}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <ShareButton title={`${a.name} on ${PLATFORM_NAME}`} text={`Books and quotes by ${a.name} on ${PLATFORM_NAME}.`} ariaLabel="Share this page" />
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
                {a.imageCredit && <> · Portrait: {a.imageCredit}</>}
              </span>
            )}
          </div>
        </header>

        <Section title={`Books by ${a.name}`}>
          <div className="grid grid-cols-1 shell:grid-cols-2 shell:gap-x-10">
            {a.books.map((b) => (
              <BookListRow key={b.id} material={b} />
            ))}
          </div>
        </Section>

        {a.quotes.length > 0 && (
          <Section title="Quotes">
            <div className="columns-1 gap-5 md:columns-2">
              {a.quotes.map((q) => (
                <QuoteCard key={q.id} quote={q} />
              ))}
            </div>
            {a.moreQuotes && (
              <Link href={`/quotes/${a.slug}`} className="text-[14px] font-semibold text-[var(--color-app-brand)]">
                All quotes by {a.name}
              </Link>
            )}
          </Section>
        )}

        {a.alongside.length > 0 && (
          <Section title={`Read alongside ${a.name}`}>
            <div className="grid grid-cols-1 shell:grid-cols-2 shell:gap-x-10">
              {a.alongside.map(({ book, why }) => (
                <BookListRow
                  key={book.id}
                  material={book}
                  detail={<p className="m-0 text-[13px]/[1.5] text-pretty text-[var(--color-app-text-secondary)]">{why}</p>}
                />
              ))}
            </div>
          </Section>
        )}

        {a.topics.length > 0 && (
          <Section title="Topics">
            <div className="flex flex-wrap gap-2">
              {a.topics.map((t) => (
                <Chip key={t} href={`/library?q=${slugifyCategory(t)}`} on={false}>
                  {t}
                </Chip>
              ))}
            </div>
          </Section>
        )}

        <JoinBar>Read {a.name} with comrades: notes on every page, and an African voice to listen in.</JoinBar>
      </article>
    </SearchableAppPage>
  );
}

import Link from "next/link";
import SearchableAppPage from "@/app/components/shell/SearchableAppPage";
import BookListRow from "@/app/components/shell/BookListRow";
import PillScrollRow from "@/app/components/shell/PillScrollRow";
import { QuoteCard } from "@/app/components/quotes/QuotesDirectory";
import { lifespan, type AuthorPage } from "@/lib/authors/authors";
import { slugifyCategory } from "@/lib/categories/slug";
import { PLATFORM_URL } from "@/lib/config/platform";
import { breadcrumbs, JsonLd } from "@/lib/seo/jsonLd";
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

const SITE_NAMES: Record<string, string> = { "wikipedia.org": "Wikipedia", "wikidata.org": "Wikidata", "britannica.com": "Britannica", "sahistory.org.za": "SA History Online", "blackpast.org": "BlackPast" };

/** A source as its site's name ("Wikipedia", "britannica.com"), not its page title. */
function siteName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const known = Object.keys(SITE_NAMES).find((d) => host === d || host.endsWith(`.${d}`));
    return known ? SITE_NAMES[known] : host;
  } catch {
    return url;
  }
}

/** The Commons page for an upload.wikimedia.org image (the original or a
 * thumbnail), where its author and licence are given in full. */
function commonsPage(src: string): string | null {
  const m = src.match(/upload\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/);
  return m ? `https://commons.wikimedia.org/wiki/File:${m[1]}` : null;
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
  // One link per site, named by the site; the page title shows on hover.
  const sources = a.sources
    .map((s) => ({ ...s, label: siteName(s.url) }))
    .filter((s, i, all) => all.findIndex((o) => o.label === s.label) === i);
  // Its Commons page, or the image itself if the URL isn't one we can map.
  const portrait = a.image && a.imageCredit ? (commonsPage(a.image) ?? a.image) : null;
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

  return (
    <SearchableAppPage className="pb-16">
      <JsonLd data={[jsonLd, breadcrumbs([["Authors", "/authors"], [a.name, `/authors/${a.slug}`]])]} />
      <article className="flex flex-col gap-5">
        <nav className="flex items-center gap-2 pt-2 text-ui-sm text-[var(--color-app-text-muted)]">
          <Link href="/authors" className="text-inherit">Authors</Link>
          <span>/</span>
          <span>{a.name}</span>
        </nav>

        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-4 md:gap-5">
            {a.image && <Portrait src={a.image} name={a.name} className="size-20 md:size-24" />}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-ui-xs font-bold tracking-eyebrow text-[var(--color-app-brand)] uppercase">Author</span>
              <h1 className="m-0 text-display-sm text-pretty text-[var(--color-app-text)]">{a.name}</h1>
              {facts.length > 0 && (
                <p className="m-0 flex flex-wrap gap-x-2 gap-y-1 text-ui-sm text-[var(--color-app-text-muted)]">
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
          {a.bio && <p className="m-0 text-reading-sm text-pretty whitespace-pre-line text-[var(--color-app-text)]">{a.bio}</p>}
          {(sources.length > 0 || portrait) && (
            <span className="text-ui-caption text-[var(--color-app-text-muted)]">
              {sources.length > 0 && (
                <>
                  Sources:{" "}
                  {sources.map((s, i) => (
                    <span key={s.url}>
                      {i > 0 && ", "}
                      <a href={s.url} title={s.title} rel="nofollow noopener" target="_blank" className="text-inherit underline">
                        {s.label}
                      </a>
                    </span>
                  ))}
                </>
              )}
              {portrait && (
                <>
                  {sources.length > 0 && " · "}
                  Portrait:{" "}
                  <a href={portrait} title={a.imageCredit} rel="nofollow noopener" target="_blank" className="text-inherit underline">
                    Wikimedia Commons
                  </a>
                </>
              )}
            </span>
          )}
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
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {a.quotes.map((q) => (
                <QuoteCard key={q.id} quote={q} />
              ))}
            </div>
            {a.moreQuotes && (
              <Link href={`/quotes/${a.slug}`} className="text-ui-body font-semibold text-[var(--color-app-brand)]">
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
            <PillScrollRow items={a.topics.map((t) => ({ key: t, label: t, active: false, href: `/topics/${slugifyCategory(t)}` }))} />
          </Section>
        )}

        <JoinBar editorial />
      </article>
    </SearchableAppPage>
  );
}

import Link from "next/link";
import { Search } from "lucide-react";
import SearchableAppPage from "@/app/components/shell/SearchableAppPage";
import { slugifyCategory } from "@/lib/categories/slug";
import { PLATFORM_URL } from "@/lib/config/platform";
import type { DirectoryQuote } from "@/lib/quotes/directory";
import type { HomePassage } from "@/lib/rooms/types";
import QuoteShare from "./QuoteShare";

// The quote directory (seo-spec.md C4; Claude Design "SEO content pages" →
// Passages.dc.html): search, topic filters, today's passage, the quotes in
// two columns, and quotes by author. Server-rendered, with plain links and a
// GET form, so every view is crawlable.

export type DirectoryView = {
  /** The view's own path: "/quotes", "/quotes/frantz-fanon", "/quotes/topic/pan-africanism". */
  path: string;
  heading: string;
  intro: string;
  crumb: string | null;
  query: string;
  topic: string | null;
  topics: string[];
  authors: { slug: string; name: string }[];
  quotes: DirectoryQuote[];
  page: number;
  more: boolean;
  today: (HomePassage & { cover: string | null; slug: string | null }) | null;
};

const pageHref = (path: string, query: string, page: number) => {
  const p = new URLSearchParams({ ...(query && { q: query }), ...(page > 1 && { page: String(page) }) }).toString();
  return p ? `${path}?${p}` : path;
};

export default function QuotesDirectory(v: DirectoryView) {
  // schema.org Quotation for each quote, each part of its Book.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: v.heading,
    url: `${PLATFORM_URL}${v.path}`,
    hasPart: v.quotes.map((q) => ({
      "@type": "Quotation",
      text: q.text,
      creator: { "@type": "Person", name: q.book.author },
      isPartOf: { "@type": "Book", name: q.book.title, url: `${PLATFORM_URL}/library/${q.book.slug}` },
    })),
  };
  return (
    <SearchableAppPage className="pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="mx-auto flex max-w-[980px] flex-col gap-5">
        <nav className="flex items-center gap-2 pt-2 text-[13px] font-medium text-[var(--color-app-text-muted)]">
          <Link href="/library" className="text-inherit">Library</Link>
          <span>/</span>
          {v.crumb ? (
            <>
              <Link href="/quotes" className="text-inherit">Quotes</Link>
              <span>/</span>
              <span>{v.crumb}</span>
            </>
          ) : (
            <span>Quotes</span>
          )}
        </nav>

        <header className="flex max-w-[720px] flex-col gap-3">
          <span className="text-[11px] font-bold tracking-eyebrow text-[var(--color-app-brand)] uppercase">Quotes</span>
          <h1 className="m-0 font-serif text-[24px]/[1.25] font-semibold text-balance md:text-[28px]/[1.2] text-[var(--color-app-text)]">{v.heading}</h1>
          <p className="m-0 text-[15px]/[1.6] text-pretty text-[var(--color-app-text-secondary)]">{v.intro}</p>
        </header>

        <form action={v.path} method="get" role="search">
          <label className="flex h-11 items-center gap-2.5 rounded-sm border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-4 text-[var(--color-app-text-muted)]">
            <Search size={18} strokeWidth={1.75} aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={v.query}
              placeholder="Search quotes, authors or books"
              aria-label="Search quotes, authors or books"
              className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-[var(--color-app-text)] outline-none"
            />
          </label>
        </form>

        {v.topics.length > 0 && (
          <nav aria-label="Topics" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
            <Chip href="/quotes" on={!v.topic && v.path === "/quotes"}>Featured</Chip>
            {v.topics.map((t) => (
              <Chip key={t} href={`/quotes/topic/${slugifyCategory(t)}`} on={t === v.topic}>
                {t}
              </Chip>
            ))}
          </nav>
        )}

        {v.today && <Today passage={v.today} />}

        {v.quotes.length > 0 ? (
          <div className="columns-1 gap-5 md:columns-2">
            {v.quotes.map((q) => (
              <QuoteCard key={q.id} quote={q} />
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-[15px] text-[var(--color-app-text-secondary)]">
            {v.query ? <>No quotes match “{v.query}”. Try an author’s name or a single word.</> : "No quotes here yet."}
          </p>
        )}

        {(v.more || v.page > 1) && (
          <nav className="flex justify-center gap-3">
            {v.page > 1 && <PageLink href={pageHref(v.path, v.query, v.page - 1)} rel="prev">Previous</PageLink>}
            {v.more && <PageLink href={pageHref(v.path, v.query, v.page + 1)} rel="next">More quotes</PageLink>}
          </nav>
        )}

        {v.authors.length > 0 && (
          <section className="mt-4 flex flex-col gap-3.5 border-t border-[var(--color-app-border)] pt-6">
            <h2 className="m-0 text-ui-md font-bold text-[var(--color-app-text)]">Quotes by author</h2>
            <div className="flex flex-wrap gap-2">
              {v.authors.map((a) => (
                <Chip key={a.slug} href={`/quotes/${a.slug}`} on={v.path === `/quotes/${a.slug}`}>
                  {a.name}
                </Chip>
              ))}
            </div>
          </section>
        )}
      </div>
    </SearchableAppPage>
  );
}

export function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`flex h-9 flex-none items-center rounded-sm border px-3.5 text-[13px] font-medium whitespace-nowrap no-underline ${
        on
          ? "border-brand-500 bg-brand-500 text-white"
          : "border-[var(--color-app-border)] text-[var(--color-app-text)] hover:bg-[var(--color-app-surface-muted)]"
      }`}
    >
      {children}
    </Link>
  );
}

function PageLink({ href, rel, children }: { href: string; rel: string; children: React.ReactNode }) {
  return (
    <Link href={href} rel={rel} className="flex h-[42px] items-center rounded-sm border border-[var(--color-app-border)] px-5 text-[14px] font-semibold text-[var(--color-app-text)] no-underline hover:bg-[var(--color-app-surface-muted)]">
      {children}
    </Link>
  );
}

function Cover({ src, className }: { src: string | null; className: string }) {
  return (
    <span className={`block flex-none overflow-hidden rounded-[3px] bg-[var(--color-app-surface-muted)] shadow-[0_1px_2px_rgba(20,17,14,.12)] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt="" loading="lazy" className="block size-full object-cover" />}
    </span>
  );
}

export function QuoteCard({ quote: q }: { quote: DirectoryQuote }) {
  return (
    <article className="mb-5 flex break-inside-avoid flex-col gap-4 rounded-sm border border-[var(--color-app-border)] p-5">
      <p className="m-0 font-serif text-[16px]/[1.65] text-pretty text-[var(--color-app-text)]">
        “{q.text}”
      </p>
      <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3">
        <Link href={`/library/${q.book.slug}`} aria-label={q.book.title}>
          <Cover src={q.book.cover} className="h-12 w-8" />
        </Link>
        <Link href={`/library/${q.book.slug}`} className="group flex min-w-0 flex-col gap-0.5 text-[13px]/[1.35] font-medium text-[var(--color-app-text-secondary)] no-underline">
          <b className="font-semibold text-[var(--color-app-text)]">{q.book.author}</b>
          <span className="truncate group-hover:underline">{q.book.title}</span>
        </Link>
        <QuoteShare text={q.text} title={q.book.title} author={q.book.author} />
      </div>
    </article>
  );
}

/** Today's passage of the day, featured at the top. */
function Today({ passage }: { passage: HomePassage & { cover: string | null; slug: string | null } }) {
  const book = passage.slug ? `/library/${passage.slug}` : null;
  return (
    <section className="grid items-center gap-5 rounded-sm bg-sand-950 px-[22px] py-[26px] text-sand-50 md:grid-cols-[minmax(0,1fr)_96px] md:gap-8 md:px-8 md:py-7">
      <div className="flex flex-col gap-4">
        <span className="text-[11px] font-bold tracking-eyebrow text-brand-300 uppercase">Quote of the day · {passage.day.replace(/^\w+, /, "")}</span>
        <p className="m-0 font-serif text-[18px]/[1.5] text-pretty md:text-[20px]/[1.5]">“{passage.excerpt}”</p>
        <span className="text-[13px]/[1.4] font-medium text-sand-50/75">
          {book ? (
            <Link href={book} className="group text-inherit no-underline">
              <b className="font-bold text-sand-50">{passage.book.author}</b> · <span className="group-hover:underline">{passage.book.title}</span>
            </Link>
          ) : (
            <>
              <b className="font-bold text-sand-50">{passage.book.author}</b> · {passage.book.title}
            </>
          )}
        </span>
        <span className="text-[13px] text-sand-50/85">
          <QuoteShare text={passage.excerpt} title={passage.book.title} author={passage.book.author} label />
        </span>
      </div>
      {book ? (
        <Link href={book} aria-label={passage.book.title} className="hidden md:block">
          <Cover src={passage.cover} className="h-[144px] w-[96px] shadow-[0_8px_24px_rgba(0,0,0,.4)]" />
        </Link>
      ) : (
        <Cover src={passage.cover} className="hidden h-[144px] w-[96px] shadow-[0_8px_24px_rgba(0,0,0,.4)] md:block" />
      )}
    </section>
  );
}

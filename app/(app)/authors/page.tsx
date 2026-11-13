import type { Metadata } from "next";
import Link from "next/link";
import SearchableAppPage from "@/app/components/shell/SearchableAppPage";
import { Portrait } from "@/app/components/authors/AuthorPageView";
import { indexableAuthors, type ListedAuthor } from "@/lib/authors/authors";
import { PLATFORM_URL } from "@/lib/config/platform";

// Every author with a page worth reading, A to Z (seo-spec.md C2): the hub
// that links each author page, with their portrait and the start of their bio.

export const revalidate = 3600;

const DESCRIPTION = "Pan-African, anti-colonial and socialist writers in the Ominira library, with their books and quotes.";
/** Shown under the H1; the longer DESCRIPTION is for search results. */
const SUBHEADING = "Writers on liberation, from Africa and beyond, with their books and quotes.";

export const metadata: Metadata = {
  title: "Authors",
  description: DESCRIPTION,
  alternates: { canonical: `${PLATFORM_URL}/authors` },
};

function AuthorRow({ a }: { a: ListedAuthor }) {
  const meta = [a.lifespan, `${a.books} ${a.books === 1 ? "book" : "books"}`].filter(Boolean).join(" · ");
  return (
    <Link href={`/authors/${a.slug}`} className="group flex min-w-0 gap-4 border-b border-[var(--color-app-border)] py-4 no-underline">
      <Portrait src={a.image} name={a.name} className="size-14" />
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <span className="font-serif text-[14px] leading-tight font-semibold text-[var(--color-app-text)] group-hover:text-brand-500">{a.name}</span>
        <span className="text-[11px] font-semibold tracking-[0.04em] text-[var(--color-app-text-muted)]">{meta}</span>
        {a.bio && (
          <span className="text-[13px]/[1.5] text-[var(--color-app-text-secondary)]">
            <span className="line-clamp-2">{a.bio}</span>
            <span className="font-semibold text-[var(--color-app-brand)]">Read more</span>
          </span>
        )}
      </span>
    </Link>
  );
}

export default async function AuthorsPage() {
  const authors = await indexableAuthors();
  const groups = new Map<string, ListedAuthor[]>();
  for (const a of authors) {
    const letter = a.name.normalize("NFD").charAt(0).toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : "#";
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return (
    <SearchableAppPage className="pb-16">
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-2 pt-2">
          <span className="text-ui-xs font-bold tracking-eyebrow text-[var(--color-app-brand)] uppercase">Library</span>
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-display-sm text-[var(--color-app-text)]">Authors</h1>
            <p className="m-0 text-reading-sm text-pretty text-[var(--color-app-text-secondary)]">{SUBHEADING}</p>
          </div>
        </header>
        <nav aria-label="Letters" className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-semibold">
          {[...groups.keys()].map((letter) => (
            <a key={letter} href={`#${letter}`} className="text-[var(--color-app-text-muted)] no-underline hover:text-[var(--color-app-brand)]">
              {letter}
            </a>
          ))}
        </nav>
        {[...groups.entries()].map(([letter, list]) => (
          <section key={letter} id={letter} className="flex scroll-mt-20 flex-col pt-4">
            <h2 className="m-0 text-ui-md font-bold text-[var(--color-app-text)]">{letter}</h2>
            <div className="grid grid-cols-1 shell:grid-cols-2 shell:gap-x-10">
              {list.map((a) => (
                <AuthorRow key={a.slug} a={a} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </SearchableAppPage>
  );
}

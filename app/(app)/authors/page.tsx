import type { Metadata } from "next";
import Link from "next/link";
import SearchableAppPage from "@/app/components/shell/SearchableAppPage";
import { indexableAuthors } from "@/lib/authors/authors";
import { PLATFORM_URL } from "@/lib/config/platform";

// Every author with a page worth reading, A to Z (seo-spec.md C2): the hub
// that links each author page.

export const revalidate = 3600;

const DESCRIPTION = "Pan-African, anti-colonial and socialist writers in the Ominira library, with their books and quotes.";

export const metadata: Metadata = {
  title: "Authors",
  description: DESCRIPTION,
  alternates: { canonical: `${PLATFORM_URL}/authors` },
};

export default async function AuthorsPage() {
  const authors = await indexableAuthors();
  const groups = new Map<string, typeof authors>();
  for (const a of authors) {
    const letter = a.name.normalize("NFD").charAt(0).toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : "#";
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return (
    <SearchableAppPage className="pb-16">
      <div className="mx-auto flex max-w-[980px] flex-col gap-5">
        <header className="flex max-w-[720px] flex-col gap-3 pt-2">
          <span className="text-[11px] font-bold tracking-eyebrow text-[var(--color-app-brand)] uppercase">Library</span>
          <h1 className="m-0 font-serif text-[24px]/[1.25] font-semibold md:text-[28px]/[1.2] text-[var(--color-app-text)]">Authors</h1>
          <p className="m-0 text-[15px]/[1.6] text-[var(--color-app-text-secondary)]">{DESCRIPTION}</p>
        </header>
        {[...groups.entries()].map(([letter, list]) => (
          <section key={letter} className="flex flex-col gap-3 border-t border-[var(--color-app-border)] pt-5">
            <h2 className="m-0 text-ui-md font-bold text-[var(--color-app-text)]">{letter}</h2>
            <ul className="m-0 grid list-none grid-cols-1 gap-x-6 gap-y-2 p-0 sm:grid-cols-2 md:grid-cols-3">
              {list.map((a) => (
                <li key={a.slug}>
                  <Link href={`/authors/${a.slug}`} className="text-[14px] font-medium text-[var(--color-app-text)] no-underline hover:text-[var(--color-app-brand)]">
                    {a.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </SearchableAppPage>
  );
}

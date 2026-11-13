import type { Metadata } from "next";
import Link from "next/link";
import SearchableAppPage from "@/app/components/shell/SearchableAppPage";
import { PLATFORM_URL } from "@/lib/config/platform";
import { listTopics, type ListedTopic } from "@/lib/topics/guides";

// Every topic page (seo-spec.md C3): the editors' guides, then the library's
// categories. The hub that links each topic page.

export const revalidate = 3600;

const DESCRIPTION = "Reading guides to Pan-African, anti-colonial and liberation history and thought, and every collection in the Ominira library.";
/** Shown under the H1; the longer DESCRIPTION is for search results. */
const SUBHEADING = "Guided reading on liberation, from Africa and beyond.";

export const metadata: Metadata = {
  title: "Topics",
  description: DESCRIPTION,
  alternates: { canonical: `${PLATFORM_URL}/topics` },
};

function TopicRow({ t }: { t: ListedTopic }) {
  return (
    <Link href={`/topics/${t.slug}`} className="group flex min-w-0 flex-col gap-1 border-b border-[var(--color-app-border)] py-4 no-underline">
      <span className="font-serif text-[15px] leading-tight font-semibold text-[var(--color-app-text)] group-hover:text-brand-500">{t.guide ? t.title : t.name}</span>
      <span className="text-[11px] font-semibold tracking-[0.04em] text-[var(--color-app-text-muted)]">
        {t.books} {t.books === 1 ? "book" : "books"}
      </span>
    </Link>
  );
}

export default async function TopicsPage() {
  const topics = await listTopics();
  const guides = topics.filter((t) => t.guide);
  const collections = topics.filter((t) => !t.guide);
  return (
    <SearchableAppPage className="pb-16">
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-2 pt-2">
          <span className="text-ui-xs font-bold tracking-eyebrow text-[var(--color-app-brand)] uppercase">Library</span>
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-display-sm text-[var(--color-app-text)]">Topics</h1>
            <p className="m-0 text-reading-sm text-pretty text-[var(--color-app-text-secondary)]">{SUBHEADING}</p>
          </div>
        </header>
        {[
          { title: "Reading guides", list: guides },
          { title: guides.length ? "More collections" : "Collections", list: collections },
        ].map(
          (g) =>
            g.list.length > 0 && (
              <section key={g.title} className="flex flex-col pt-0">
                {/* <h2 className="m-0 text-ui-md font-bold text-[var(--color-app-text)]">{g.title}</h2> */}
                <div className="grid grid-cols-1 shell:grid-cols-2 shell:gap-x-10">
                  {g.list.map((t) => (
                    <TopicRow key={t.slug} t={t} />
                  ))}
                </div>
              </section>
            )
        )}
      </div>
    </SearchableAppPage>
  );
}

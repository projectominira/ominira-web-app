import type { Metadata } from "next";
import SearchableAppPage from "@/app/components/shell/SearchableAppPage";
import { ListCard } from "@/app/components/readingLists/ReadingListView";
import { PLATFORM_URL } from "@/lib/config/platform";
import { listReadingLists } from "@/lib/readingLists/lists";

// Every reading list, newest first (seo-spec.md C1): the hub that links each.

// A list goes live at 07:00 Lagos; this page catches up within minutes.
export const revalidate = 300;

const DESCRIPTION = "A reading list each month from the Ominira editors: books on Pan-African, anti-colonial and liberation history and thought, with where to start.";

export async function generateMetadata(): Promise<Metadata> {
  const any = (await listReadingLists(1)).length > 0;
  return {
    title: "Reading lists",
    description: DESCRIPTION,
    alternates: { canonical: `${PLATFORM_URL}/reading-lists` },
    // Empty, it's a thin page: indexed from the first list.
    ...(!any && { robots: { index: false, follow: true } }),
  };
}

export default async function ReadingListsPage() {
  const lists = await listReadingLists();
  return (
    <SearchableAppPage className="pb-16">
      <div className="mx-auto flex max-w-[980px] flex-col gap-5">
        <header className="flex max-w-[720px] flex-col gap-3 pt-2">
          <span className="text-[11px] font-bold tracking-eyebrow text-[var(--color-app-brand)] uppercase">Library</span>
          <h1 className="m-0 font-serif text-[24px]/[1.25] font-semibold text-[var(--color-app-text)] md:text-[28px]/[1.2]">Reading lists</h1>
          <p className="m-0 text-[14px]/[1.6] text-[var(--color-app-text-secondary)]">{DESCRIPTION}</p>
        </header>
        {lists.length ? (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
            {lists.map((l) => (
              <ListCard key={l.slug} l={l} />
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-[var(--color-app-text-muted)]">The first list is on its way.</p>
        )}
      </div>
    </SearchableAppPage>
  );
}

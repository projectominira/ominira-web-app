import type { Metadata } from "next";
import QuotesDirectory from "@/app/components/quotes/QuotesDirectory";
import { directoryMetadata, directoryView, type DirectoryParams } from "@/lib/quotes/page";

// The quote directory (seo-spec.md C4).

const INTRO = "Quotes from Pan-African and anti-colonial books, each taken word for word from the page.";

export async function generateMetadata({ searchParams }: { searchParams: Promise<DirectoryParams> }): Promise<Metadata> {
  return directoryMetadata("/quotes", "Pan-African and anti-colonial quotes", INTRO, await searchParams);
}

export default async function QuotesPage({ searchParams }: { searchParams: Promise<DirectoryParams> }) {
  const view = await directoryView({ path: "/quotes", heading: "Quotes from the Ominira library", intro: INTRO, crumb: null }, await searchParams);
  return <QuotesDirectory {...view} />;
}

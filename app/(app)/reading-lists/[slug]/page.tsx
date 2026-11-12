import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReadingListView from "@/app/components/readingLists/ReadingListView";
import { PLATFORM_URL } from "@/lib/config/platform";
import { getReadingList } from "@/lib/readingLists/lists";

// A monthly reading list (seo-spec.md C1): answers "books on <topic>",
// "where to start with <topic>". Live from 07:00 Lagos on its day.

const load = cache(getReadingList);

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await load((await params).slug);
  if (!l) return {};
  const url = `${PLATFORM_URL}/reading-lists/${l.slug}`;
  const first = l.intro.split(/\n\s*\n/)[0];
  const description = first.length > 160 ? `${first.slice(0, 157).replace(/\s+\S*$/, "")}…` : first;
  // The share image comes from ./opengraph-image.tsx.
  return {
    title: l.title,
    description,
    alternates: { canonical: url },
    openGraph: { title: l.title, description, url, type: "article" },
    twitter: { card: "summary_large_image", title: l.title, description },
  };
}

export default async function ReadingListPage({ params }: Props) {
  const l = await load((await params).slug);
  if (!l) notFound();
  return <ReadingListView l={l} />;
}

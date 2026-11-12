import { cache } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import TopicPageView from "@/app/components/topics/TopicPageView";
import { PLATFORM_NAME, PLATFORM_URL } from "@/lib/config/platform";
import { getTopicPage } from "@/lib/topics/guides";
import { listsForTopic } from "@/lib/readingLists/lists";

// A topic page (seo-spec.md C3): answers "books on <topic>", "<topic> books".

const load = cache(getTopicPage);

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await load((await params).slug);
  if (!t) return {};
  const url = `${PLATFORM_URL}/topics/${t.slug}`;
  const first = t.intro.split(/\n\s*\n/)[0] ?? "";
  const description = first
    ? (first.length > 160 ? `${first.slice(0, 157).replace(/\s+\S*$/, "")}…` : first)
    : `${t.all.length} books on ${t.name} in the ${PLATFORM_NAME} library, to read or listen to: ${t.all.slice(0, 3).map((b) => b.title).join(", ")} and more.`;
  return {
    title: t.title,
    description,
    alternates: { canonical: url },
    openGraph: { title: t.title, description, url, type: t.stages.length ? "article" : "website" },
    ...(!t.indexable && { robots: { index: false, follow: true } }),
  };
}

export default async function TopicPage({ params }: Props) {
  const { slug } = await params;
  const t = await load(slug);
  if (!t) notFound();
  // A renamed category's old slug, or its slug when its guide has its own.
  if (t.slug !== slug) permanentRedirect(`/topics/${t.slug}`);
  const lists = await listsForTopic(t.slug).catch(() => []);
  return <TopicPageView t={t} lists={lists} />;
}

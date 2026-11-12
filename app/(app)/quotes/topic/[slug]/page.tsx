import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QuotesDirectory from "@/app/components/quotes/QuotesDirectory";
import { getCategories } from "@/lib/categories/config";
import { slugifyCategory } from "@/lib/categories/slug";
import { directoryMetadata, directoryView, type DirectoryParams } from "@/lib/quotes/page";

// Quotes on one topic (a library category): ranks for "quotes about <topic>" (seo-spec.md C4).

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<DirectoryParams> };

const topicOf = async (slug: string) => (await getCategories()).find((c) => slugifyCategory(c) === slug) ?? null;
const intro = (topic: string) => `Quotes on ${topic.toLowerCase()} from the Ominira library, each taken word for word from the book.`;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const topic = await topicOf(slug);
  if (!topic) return {};
  return directoryMetadata(`/quotes/topic/${slug}`, `${topic} quotes`, intro(topic), await searchParams);
}

export default async function TopicQuotesPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const topic = await topicOf(slug);
  if (!topic) notFound();
  const view = await directoryView({ path: `/quotes/topic/${slug}`, heading: `${topic} quotes`, intro: intro(topic), crumb: topic, topic }, await searchParams);
  return <QuotesDirectory {...view} />;
}

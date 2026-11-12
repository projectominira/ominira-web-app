import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QuotesDirectory from "@/app/components/quotes/QuotesDirectory";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { directoryMetadata, directoryView, type DirectoryParams } from "@/lib/quotes/page";

// One author's quotes: ranks for "<author> quotes" (seo-spec.md C4).

const getAuthor = cache(async (slug: string) => {
  const { data, error } = await getSupabaseAdminClient().from("authors").select("id, name").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
});

type Props = { params: Promise<{ author: string }>; searchParams: Promise<DirectoryParams> };

const intro = (name: string) => `Quotes by ${name}, each taken word for word from their books in the Ominira library.`;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const author = await getAuthor((await params).author);
  if (!author) return {};
  return directoryMetadata(`/quotes/${(await params).author}`, `${author.name} quotes`, intro(author.name), await searchParams);
}

export default async function AuthorQuotesPage({ params, searchParams }: Props) {
  const { author: slug } = await params;
  const author = await getAuthor(slug);
  if (!author) notFound();
  const view = await directoryView(
    { path: `/quotes/${slug}`, heading: `${author.name} quotes`, intro: intro(author.name), crumb: author.name, authorId: author.id },
    await searchParams
  );
  return <QuotesDirectory {...view} />;
}

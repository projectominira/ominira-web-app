import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AuthorPageView from "@/app/components/authors/AuthorPageView";
import { getAuthorPage } from "@/lib/authors/authors";
import { PLATFORM_NAME, PLATFORM_URL } from "@/lib/config/platform";

// An author page (seo-spec.md C2): answers "<author> books", "<author> bio".

const load = cache(getAuthorPage);

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await load((await params).slug);
  if (!a) return {};
  const url = `${PLATFORM_URL}/authors/${a.slug}`;
  const titles = a.books.slice(0, 3).map((b) => b.title).join(", ");
  const description = a.bio
    ? (a.bio.length > 160 ? `${a.bio.slice(0, 157).trimEnd()}…` : a.bio)
    : `Read ${a.name} on ${PLATFORM_NAME}: ${titles}${a.books.length > 3 ? " and more" : ""}.`;
  return {
    title: a.quotes.length ? `${a.name}: books and quotes` : `${a.name}: books`,
    description,
    alternates: { canonical: url },
    openGraph: { title: a.name, description, url, type: "profile" },
    ...(!a.indexable && { robots: { index: false, follow: true } }),
  };
}

export default async function AuthorPage({ params }: Props) {
  const a = await load((await params).slug);
  if (!a) notFound();
  return <AuthorPageView a={a} />;
}

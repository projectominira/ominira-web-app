import { cache } from "react";
import type { Metadata } from "next";
import { getMaterialDetail, MaterialNotFoundError, type MaterialDetail } from "@/lib/materials/detail";
import BookPage from "@/app/components/materials/BookPage";
import BookRoomView from "@/app/components/materials/BookRoomView";
import BookExtras from "@/app/components/materials/BookExtras";
import { getBookExtras } from "@/lib/materials/extras";
import { BOOK_ROOMS } from "@/lib/config/features";
import { PLATFORM_NAME, PLATFORM_URL } from "@/lib/config/platform";
import { resolveBookCoverSrc } from "@/lib/materials/image";
import { missingBook } from "@/lib/materials/oldSlug";
import { slugifyCategory } from "@/lib/categories/slug";
import { breadcrumbs, JsonLd } from "@/lib/seo/jsonLd";

// generateMetadata and the page both need the book; load it once per request.
const getDetail = cache(getMaterialDetail);

const bookPath = (slug: string) => `/library/${slug}`;

/** The book's blurb, as plain text. */
function blurbOf(material: MaterialDetail) {
  const text = material.description ?? material.googleDescription ?? material.openlibraryDescription;
  return text?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  let material;
  try {
    material = await getDetail(slug);
  } catch (err) {
    // A renamed book redirects; an unknown slug is a real 404 (seo-spec.md T2, T6).
    if (err instanceof MaterialNotFoundError) return missingBook(slug, bookPath);
    throw err;
  }
  const { title, author } = material;
  const url = `${PLATFORM_URL}/library/${slug}`;
  const blurb = blurbOf(material);
  const desc = blurb ? (blurb.length > 200 ? `${blurb.slice(0, 197).trimEnd()}…` : blurb) : `${title} by ${author} — read or listen on ${PLATFORM_NAME}.`;
  // The share image comes from ./opengraph-image.tsx (served from our domain).
  // The author goes in the tab/search title: people search "fanon wretched of the earth".
  const hasAuthor = author && !/^unknown$/i.test(author.trim());
  return {
    title: hasAuthor ? `${title} by ${author}` : title,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title, description: desc, url, type: "book" },
    twitter: { card: "summary_large_image", title, description: desc },
  };
}

export default async function MaterialDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  /** While book rooms are shown: `?tab=room` opens on the room alone; with the book's info over it otherwise. Ignored while they're hidden. */
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab } = await searchParams;

  let material;
  try {
    material = await getDetail(slug);
  } catch (err) {
    if (err instanceof MaterialNotFoundError) return missingBook(slug, bookPath);
    throw err;
  }
  const extras = BOOK_ROOMS ? null : await getBookExtras(material);
  const blurb = blurbOf(material);
  const image = resolveBookCoverSrc(material);
  // schema.org Book, so search engines read title/author/cover directly.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: material.title,
    // Each author's page carries their Person (seo-spec T9).
    author: material.authors.length
      ? material.authors.map((a) => ({ "@type": "Person", name: a.name, url: `${PLATFORM_URL}/authors/${a.slug}` }))
      : { "@type": "Person", name: material.author },
    url: `${PLATFORM_URL}/library/${slug}`,
    ...(image && { image }),
    ...(blurb && { description: blurb }),
    ...(material.publishedYear && { datePublished: String(material.publishedYear) }),
  };
  // Breadcrumbs through the book's first category's topic page.
  const category = material.categories[0];
  const trail = breadcrumbs([
    ...(category ? ([["Topics", "/topics"], [category, `/topics/${slugifyCategory(category)}`]] as [string, string][]) : [["Library", "/library"] as [string, string]]),
    [material.title, bookPath(slug)],
  ]);
  return (
    <>
      <JsonLd data={[jsonLd, trail]} />
      {BOOK_ROOMS ? <BookRoomView material={material} initialInfo={tab !== "room"} /> : <BookPage material={material} extras={extras && <BookExtras extras={extras} title={material.title} author={material.author} />} />}
    </>
  );
}

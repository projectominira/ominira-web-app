import { notFound } from "next/navigation";
import { getMaterialDetail, MaterialNotFoundError } from "@/lib/materials/detail";
import BookPanel from "@/app/components/materials/BookPanel";
import BookExtras from "@/app/components/materials/BookExtras";
import { getBookExtras } from "@/lib/materials/extras";

/** A click on a book anywhere in the app (a client-side navigation to
 * /library/[slug]) opens its info in BookPanel over the current page; a
 * refresh or a shared link still lands on app/(app)/library/[slug]. */
export default async function BookPanelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const material = await getMaterialDetail(slug).catch((err) => {
    if (err instanceof MaterialNotFoundError) notFound();
    throw err;
  });
  const extras = await getBookExtras(material);
  return <BookPanel material={material} extras={<BookExtras extras={extras} title={material.title} author={material.author} />} />;
}

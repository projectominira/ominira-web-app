import Link from "next/link";
import BookCover from "@/app/components/shared/BookCover";
import { resolveBookCoverSrc } from "@/lib/materials/image";
import type { FeaturedRow } from "@/lib/rooms/types";

/** Featured books: 150 px covers in a sideways scroll, each with its title
 * and author, opening the book's page. */
export default function FeaturedBooks({ rows }: { rows: FeaturedRow[] }) {
  return (
    <section>
      <h2 className="font-serif type-3 m-0 mb-5 text-balance text-[var(--reader-text)]">Featured books</h2>
      <div className="flex gap-4 overflow-x-auto pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.map(({ material: m }) => (
          <Link key={m.id} href={`/library/${m.slug}`} className="group block w-[150px] flex-none no-underline">
            <div className="h-[225px] w-[150px] overflow-hidden rounded-sm border border-[var(--reader-border)] shadow-md">
              <BookCover materialType={m.materialType} src={resolveBookCoverSrc(m)} alt={m.title} className="h-full w-full" />
            </div>
            <div className="mt-2.5 text-[12px] leading-tight font-bold text-[var(--reader-text)] group-hover:text-brand-500">{m.title}</div>
            <div className="mt-0.5 text-[11px] font-semibold text-[var(--reader-text-muted)]">{m.author}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

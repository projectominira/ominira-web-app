import Link from "next/link";
import type { LandingBook } from "@/lib/landing/view";

// The landing's book cover: one 2:3 slot that opens the book. Supplied art
// fills it on its own (the cover says what the book is); a book without
// art gets one of four typographic layouts in a palette from the covers
// (both picked from its id, so a book always looks the same). Sizes are in
// cqw, so a cover reads the same at any width.

/** [background, ink, accent] */
const PALETTES = [
  ["--color-sand-950", "--color-sand-50", "--color-brand-300"],
  ["--color-oxblood-500", "--color-sand-50", "--color-brand-200"],
  ["--color-olive-500", "--color-sand-50", "--color-quote-wash"],
  ["--color-forest-500", "--color-sand-50", "--color-brand-200"],
  ["--color-brand-500", "--color-sand-25", "--color-sand-950"],
  ["--color-sand-50", "--color-sand-950", "--color-brand-500"],
  ["--color-brand-800", "--color-sand-50", "--color-brand-300"],
  ["--color-sand-800", "--color-sand-50", "--color-quote-wash"],
  ["--color-oxblood-600", "--color-quote-wash", "--color-brand-300"],
].map((p) => p.map((v) => `var(${v})`));

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Title size (cqw) by length. */
const titleSize = (t: string) => (t.length <= 12 ? 15 : t.length <= 20 ? 13 : t.length <= 30 ? 11.5 : t.length <= 40 ? 10 : 8.6);

const SERIF_TITLE = "font-serif font-semibold leading-[1.06] text-balance";
const AUTHOR_CAPS = "font-sans text-[5.4cqw] font-bold tracking-[0.08em] uppercase";

function Typeset({ book }: { book: LandingBook }) {
  const h = hash(book.id);
  const [bg, ink, acc] = PALETTES[h % PALETTES.length];
  const size = { fontSize: `${titleSize(book.title)}cqw` };
  const author = book.author ?? "";
  const layout = (h >> 4) % 4;
  return (
    <div className="absolute inset-0" style={{ background: bg, color: ink }}>
      {layout === 0 && (
        <div className="absolute inset-0 flex flex-col justify-between px-[10cqw] py-[11cqw]">
          <div className={AUTHOR_CAPS} style={{ color: acc }}>
            {author}
          </div>
          <div className="flex flex-col gap-[5cqw]">
            <div className="h-[1.2cqw] w-[20cqw]" style={{ background: acc }} />
            <div className={SERIF_TITLE} style={size}>
              {book.title}
            </div>
          </div>
        </div>
      )}
      {layout === 1 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[7cqw] p-[10cqw] text-center">
          <div className="font-sans leading-[1.02] font-extrabold text-balance uppercase" style={{ fontSize: `${(titleSize(book.title) * 0.86).toFixed(2)}cqw`, color: acc }}>
            {book.title}
          </div>
          <div className="font-sans text-[5cqw] font-bold tracking-[0.1em] uppercase">{author}</div>
        </div>
      )}
      {layout === 2 && (
        <>
          <div className="absolute top-[12cqw] left-1/2 -ml-[27cqw] size-[54cqw] rounded-full" style={{ background: acc }} />
          <div className="absolute inset-x-0 top-[46cqw] h-[1cqw]" style={{ background: bg }} />
          <div className="absolute inset-x-0 top-[52cqw] h-[1.6cqw]" style={{ background: bg }} />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-[3cqw] px-[10cqw] pb-[11cqw] text-center">
            <div className={SERIF_TITLE} style={size}>
              {book.title}
            </div>
            <div className="font-sans text-[5cqw] font-semibold opacity-85">{author}</div>
          </div>
        </>
      )}
      {layout === 3 && (
        <>
          <div className={`absolute top-[11cqw] right-[10cqw] left-[10cqw] ${AUTHOR_CAPS}`}>{author}</div>
          <div className="absolute inset-x-0 bottom-0 box-border flex min-h-[52%] items-end px-[10cqw] pt-[9cqw] pb-[11cqw]" style={{ background: acc, color: bg }}>
            <div className={SERIF_TITLE} style={size}>
              {book.title}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Art({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />;
}

/** `className` sizes the cover (a width); `shadow` is its box-shadow class.
 * `link={false}` when it sits inside a link already, or is decoration. */
export default function Cover({ book, className = "", shadow = "shadow-md", link = true }: { book: LandingBook; className?: string; shadow?: string; link?: boolean }) {
  const face = (
    <div className={`relative aspect-2/3 overflow-hidden rounded-xs bg-current/8 ${shadow}`}>
      {book.cover ? <Art src={book.cover} /> : <Typeset book={book} />}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(90deg,rgba(0,0,0,0.22)_0,rgba(255,255,255,0.10)_2.5%,rgba(0,0,0,0)_7%)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]" />
    </div>
  );
  if (!link) return <div className={`@container ${className}`}>{face}</div>;
  return (
    <Link
      href={`/library/${book.slug}`}
      aria-label={book.author ? `${book.title} by ${book.author}` : book.title}
      className={`@container block no-underline transition-transform duration-[260ms] ease-out hover:-translate-y-1.5 ${className}`}
    >
      {face}
    </Link>
  );
}

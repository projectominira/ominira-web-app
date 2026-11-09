import "server-only";

import { getFeaturedBooks } from "@/lib/featured/config";
import { homeGroups } from "@/lib/groups/home";
import { resolveBookCoverSrc, resolveBookThumbnailSrc } from "@/lib/materials/image";
import { getCatalogue, getReadingCounts } from "@/lib/recommend/books";
import { getStrip } from "@/lib/rooms/homeView";
import type { MaterialSummary } from "@/lib/api/types";
import type { GroupCardView, StatusItem } from "@/lib/rooms/types";
import { isPlainCover } from "./plain";

// The signed-out landing page (app/page.tsx), in one call. The books come
// from lib/recommend/books's catalogue and reading counts (cached in
// memory there), so only Featured, the groups and the live
// rooms query; the page itself is regenerated every minute (ISR).
//
// Covers are the show: a book uploaded twice (EPUB and PDF) appears once,
// the hero wall is EPUB covers only (a PDF's is often a scanned page), and
// a plain cover (lib/landing/plain) is left out — or, in a fixed list
// (Featured, Most read), drawn as a typeset cover instead.

/** Covers in the hero's wall: three rows. */
const WALL_ROW = 12;
const MOST_READ = 9;
/** Left out of Most read (by title); the next most read takes the place. */
const MOST_READ_SKIP = ["Twenty Enemy Forces"];
/** Books on a shelf at most. */
const SHELF = 12;
/** The shelves, in order: the library category, its name here and line. */
/** The shelves, in order: the library category (its link), the shelf's
 * name and line, and by title (lib/landing titleKey) books to put first
 * (`pin`, taken from any other shelf), leave off (`skip`), or, for a
 * hand-picked shelf, its books (`only`, in order). */
type ShelfSpec = { category: string; title: string; line: string; pin?: string[]; skip?: string[]; only?: string[] };
const SHELVES: ShelfSpec[] = [
  {
    category: "Pan-Africanism",
    title: "Pan-Africanism",
    line: "One continent, one people, one struggle.",
    pin: ["Africa Must Unite", "Neocolonialism, the Last Stage of Imperialism", "The Wretched of the Earth", "How Europe Underdeveloped Africa", "Philosophy and Opinions of Marcus Garvey"],
    skip: ["The Groundings with My Brothers", "Return to the Source", "Women's Liberation and the African Freedom Struggle"],
  },
  {
    category: "Revolution & Resistance",
    title: "Revolution",
    line: "Theory and testimony from the front lines.",
    pin: ["The Black Jacobins", "American Negro Slave Revolts"],
  },
  { category: "Feminism & Gender", title: "Women in the struggle", line: "Organisers, writers and fighters." },
  {
    category: "Biography",
    title: "Lives of the struggle",
    line: "Cabral, Biko, Hani, Assata, Malcolm X and more.",
    only: [
      "Amilcar Cabral",
      "Biko",
      "Chris Hani",
      "Assata: An Autobiography",
      "The Autobiography of Malcolm X",
      "Thomas Sankara",
      "Frantz Fanon",
      "Ghana: The Autobiography of Kwame Nkrumah",
      "The Assassination of Lumumba",
      "Steve Biko",
      "Stokely: A Life",
      "Black Moses",
      "Narrative of the Life of Frederick Douglass",
      "The Interesting Narrative of the Life of Olaudah Equiano",
      "A Life in Exile",
    ],
  },
  { category: "African History", title: "History", line: "The record, told by those it was done to." },
];
/** A category needs this many books for a shelf. */
const SHELF_MIN = 6;
const GROUPS = 3;
/** The sample groups' books, then the sample rooms' (StudyTogether). */
const SAMPLE_TITLES = ["The Wretched of the Earth", "How Europe Underdeveloped Africa", "I Write What I Like", "Africa Must Unite"];
/** The book the voice samples read from (lib/audio voice samples). */
const PASSAGE_TITLE = "The Wretched of the Earth";
/** Covers the landing leaves out of the wall and shelves (they read
 * poorly at shelf size), by title. */
const HIDDEN = ["Kwame Nkrumah's Contribution to Pan-African Agency", "Making the Revolution Global", "Malcolm X Speaks Selected Speeches and Statements"];
/** Always on the hero wall, in its first row (by title). */
const WALL_PINNED = ["The Autobiography of Malcolm X"];
/** The MAE principles: the landing gives them their own section, so they
 * stay off the wall, out of Featured and out of Most read. */
export const PRINCIPLES_SLUG = "mae-principles";
/** Featured's spotlight, whatever its place in the editors' list. */
const FEATURED_LEAD = "The Little Red Book";
/** Featured's covers beside the spotlight at most: two rows of four. */
const FEATURED_BESIDE = 8;

export type LandingBook = Pick<MaterialSummary, "id" | "slug" | "title" | "author"> & {
  cover: string | null;
  readers: number;
  /** Featured only: the editors' line on it, else the book's description. */
  blurb?: string;
};
export type LandingShelf = { category: string; title: string; line: string; books: LandingBook[] };

export type LandingView = {
  /** The hero's cover wall, three rows; good EPUB covers only. */
  wall: LandingBook[][];
  featured: LandingBook[];
  /** Most read now: the most readers mid-book first; none, no list. */
  mostRead: LandingBook[];
  shelves: LandingShelf[];
  /** The voice samples' book; null if it's left the catalogue. */
  passage: LandingBook | null;
  /** Public study groups (homeGroups signed out: all to join). */
  groups: GroupCardView[];
  /** Rooms live now. */
  live: StatusItem[];
  /** Books for the sample groups and rooms shown while none are public or
   * live (StudyTogether): SAMPLE_TITLES, else the most read with covers. */
  samples: LandingBook[];
};

/** One book however many times it's uploaded: its title before any
 * subtitle, letters and digits only. */
const titleKey = (title: string) => title.toLowerCase().split(":")[0].replace(/[^\p{L}\p{N}]/gu, "");

export async function getLandingView(): Promise<LandingView> {
  const [{ books }, counts, featured, groups, live] = await Promise.all([
    getCatalogue(),
    getReadingCounts(),
    getFeaturedBooks(),
    homeGroups(null),
    getStrip(),
  ]);

  // Readers per book, both uploads together; the EPUB stands for the book.
  const readersOf = new Map<string, number>();
  const one = new Map<string, MaterialSummary>();
  for (const m of books.values()) {
    const k = titleKey(m.title);
    readersOf.set(k, (readersOf.get(k) ?? 0) + (counts.get(m.id) ?? 0));
    const kept = one.get(k);
    const better = !kept || (kept.materialType !== "book" && m.materialType === "book") || (!resolveBookThumbnailSrc(kept) && resolveBookThumbnailSrc(m));
    if (better) one.set(k, m);
  }
  const readers = (m: MaterialSummary) => readersOf.get(titleKey(m.title)) ?? 0;
  const ranked = [...one.values()].sort((a, b) => readers(b) - readers(a) || a.title.localeCompare(b.title));

  // Only what the page shows, at thumbnail size (`full`: the full cover,
  // for a slot wider than the 320px thumbnail).
  const view = (m: MaterialSummary, full = false): LandingBook => ({
    id: m.id,
    slug: m.slug,
    title: m.title,
    author: m.author,
    cover: full ? resolveBookCoverSrc(m) : resolveBookThumbnailSrc(m),
    readers: readers(m),
  });
  const plain = (m: MaterialSummary) => {
    const src = resolveBookThumbnailSrc(m);
    return src ? isPlainCover(src).catch(() => false) : Promise.resolve(true);
  };
  /** The first `n` of `list` with a good cover, checked a batch at a time. */
  const good = async (list: MaterialSummary[], n: number) => {
    const out: MaterialSummary[] = [];
    for (let i = 0; i < list.length && out.length < n; i += n) {
      const batch = list.slice(i, i + n);
      const flags = await Promise.all(batch.map(plain));
      out.push(...batch.filter((_, j) => !flags[j]));
    }
    return out.slice(0, n);
  };
  /** A fixed list: a plain cover is drawn typeset (Cover's no-art face). */
  const typesetPlain = async (list: MaterialSummary[], full = 0) => {
    const flags = await Promise.all(list.map(plain));
    return list.map((m, i) => (flags[i] ? { ...view(m), cover: null } : view(m, i < full)));
  };

  const inCategory = new Map<string, MaterialSummary[]>();
  for (const m of ranked) for (const c of m.categories) inCategory.set(c, [...(inCategory.get(c) ?? []), m]);
  const titled = (t: string) => ranked.find((m) => titleKey(m.title) === titleKey(t));
  const passage = titled(PASSAGE_TITLE);

  const hidden = new Set(HIDDEN.map(titleKey));
  const mostReadSkip = new Set(MOST_READ_SKIP.map(titleKey));
  const pinned = WALL_PINNED.flatMap((t) => titled(t) ?? []);
  const editors = featured.filter((f) => f.material.slug !== PRINCIPLES_SLUG);
  const at = editors.findIndex((f) => titleKey(f.material.title) === titleKey(FEATURED_LEAD));
  const editorsPicks = at > 0 ? [editors[at], ...editors.filter((_, i) => i !== at)] : editors;
  // Featured: the spotlight, then whole rows of four beside it (two at
  // most); a short row is topped up with the most read good covers.
  const featuredOnce = async () => {
    const beside = editorsPicks.length - 1;
    const short = beside > 0 ? Math.min(FEATURED_BESIDE, Math.ceil(beside / 4) * 4) - beside : 0;
    const chosen = new Set(editorsPicks.map((f) => titleKey(f.material.title)));
    const extra = short > 0 ? await good(ranked.filter((m) => m.materialType === "book" && m.slug !== PRINCIPLES_SLUG && !chosen.has(titleKey(m.title))), short) : [];
    const picks = [...editorsPicks, ...extra.map((material) => ({ material, blurb: "" }))];
    const books = await typesetPlain(
      picks.map((f) => f.material),
      1
    );
    return books.map((b, i) => {
      const m = picks[i].material;
      return { ...b, blurb: picks[i].blurb || m.googleDescription || m.openlibraryDescription || m.description || undefined };
    });
  };
  // A book on several shelves shows on one: pinned and hand-picked books
  // are claimed first, then the narrower shelves (later in SHELVES) claim
  // theirs, Pan-Africanism, the broadest, last.
  const shelvesOnce = async () => {
    const byTitle = (ts: string[] = []) => ts.flatMap((t) => titled(t) ?? []);
    const taken = new Set(SHELVES.flatMap((s) => [...byTitle(s.pin), ...byTitle(s.only)]).map((m) => m.id));
    const order = [...SHELVES.filter((s) => s.only), ...SHELVES.filter((s) => !s.only).reverse()];
    const picked = new Map<ShelfSpec, MaterialSummary[]>();
    for (const s of order) {
      const skip = new Set((s.skip ?? []).map(titleKey));
      const rest = (inCategory.get(s.category) ?? []).filter((m) => !taken.has(m.id) && !hidden.has(titleKey(m.title)) && !skip.has(titleKey(m.title)));
      const books = await good(s.only ? byTitle(s.only) : [...byTitle(s.pin), ...rest], SHELF);
      for (const m of books) taken.add(m.id);
      picked.set(s, books);
    }
    return SHELVES.map(({ category, title, line }, i) => ({ category, title, line, books: picked.get(SHELVES[i])!.map((m) => view(m)) }));
  };
  const [wall, shelves, featuredBooks, mostRead, sampleBooks] = await Promise.all([
    good(
      ranked.filter((m) => m.materialType === "book" && m.slug !== PRINCIPLES_SLUG && !hidden.has(titleKey(m.title)) && !pinned.includes(m)),
      WALL_ROW * 3
    ),
    shelvesOnce(),
    featuredOnce(),
    typesetPlain(ranked.filter((m) => readers(m) > 0 && m.slug !== PRINCIPLES_SLUG && !mostReadSkip.has(titleKey(m.title))).slice(0, MOST_READ)),
    good(
      [...new Set([...SAMPLE_TITLES.flatMap((t) => titled(t) ?? []), ...ranked.filter((m) => m.materialType === "book")])],
      SAMPLE_TITLES.length
    ),
  ]);

  return {
    // The pinned books a few covers in, where the wall's fade has cleared.
    wall: [0, 1, 2].map((i) => [...wall.slice(0, 3), ...pinned, ...wall.slice(3)].slice(i * WALL_ROW, (i + 1) * WALL_ROW).map((m) => view(m))),
    featured: featuredBooks,
    mostRead,
    shelves: shelves.filter((s) => s.books.length >= SHELF_MIN),
    passage: passage ? view(passage, true) : null,
    groups: groups.slice(0, GROUPS),
    live,
    samples: sampleBooks.map((m) => view(m)),
  };
}

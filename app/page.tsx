import type { Metadata } from "next";
import Link from "next/link";
import HomeInstallBanner from "@/app/components/home/HomeInstallBanner";
import Cover from "@/app/components/landing/Cover";
import Shelf from "@/app/components/landing/Shelf";
import SignedInRedirect, { HIDE_WHEN_SIGNED_IN } from "@/app/components/landing/SignedInRedirect";
import StudyTogether from "@/app/components/landing/StudyTogether";
import Voices from "@/app/components/landing/Voices";
import { BUTTON, BUTTON_SM, GUTTER, INVERSE, PRIMARY, SECTION_LINE, SECTION_TITLE } from "@/app/components/landing/styles";
import { slugifyCategory } from "@/lib/categories/slug";
import { BRAND_TAGLINE, SPLASH_MARK, WORDMARK, WORDMARK_RATIO } from "@/lib/config/brand-assets";
import { PLATFORM_NAME } from "@/lib/config/platform";
import { getLandingView, PRINCIPLES_SLUG } from "@/lib/landing/view";

const HEADLINE = "Thousands of books to raise your Pan-Africanist consciousness.";
const SUB = "Read, or listen with African voices.";

export const metadata: Metadata = {
  title: { absolute: `${PLATFORM_NAME} — ${HEADLINE}` },
  description: `${HEADLINE} ${SUB}`,
  alternates: { canonical: "/" },
};

// Built on the server for search engines, regenerated every minute.
export const revalidate = 60;

const WRAP = "mx-auto max-w-[1328px]";
const EYEBROW = "text-ui-xs tracking-eyebrow uppercase";
/** Each wall row's drift: seconds per loop, and which way. */
const DRIFT = [
  { s: 120, reverse: false },
  { s: 160, reverse: true },
  { s: 96, reverse: false },
];
/** Shelf cover widths, by band: light, or dark (bigger). At most 180px, so
 * the 320px thumbnails stay sharp. */
/** The MAE principles, in the document's order (its section headings). */
const PRINCIPLES = [
  "Pan-Africanism",
  "Critical Thinking",
  "Mental Emancipation",
  "Cultural Renaissance",
  "Youth Leadership",
  "Women Leadership",
  "People-Centred Government & Collective Leadership",
];
const PRINCIPLES_HREF = `/library/${PRINCIPLES_SLUG}`;
const SHELF_COVER = ["w-[132px] md:w-[clamp(132px,11vw,160px)]", "w-40 md:w-[clamp(160px,13vw,180px)]"];

function Wordmark({ className }: { className: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={WORDMARK} alt={PLATFORM_NAME} width={20 * WORDMARK_RATIO} height={20} className={`block w-auto ${className}`} />;
}

/**
 * The landing page, signed out (signed in, it's Home: SignedInRedirect).
 * Outside the (app) layout: no AppShell, sidebar or mobile nav.
 */
export default async function LandingPage() {
  const view = await getLandingView();
  // Featured: the first book in the spotlight, the rest in rows of four
  // beside it (whole rows, eight at most: lib/landing/view).
  const [lead, ...rest] = view.featured;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: HIDE_WHEN_SIGNED_IN }} />
      <style>{"html[data-signed-in] #landing{visibility:hidden}"}</style>
      <SignedInRedirect />
      <HomeInstallBanner inline />
      <div id="landing" className="w-full overflow-x-clip bg-[var(--reader-bg)] font-sans text-[var(--reader-text)] subpixel-antialiased">
        <header id="landing-header" className="border-b border-white/8 bg-sand-950 text-sand-25">
          <div className={`mx-auto flex max-w-[1440px] items-center justify-between gap-4 py-3 md:py-4 ${GUTTER}`}>
            <Link href="/" aria-label={`${PLATFORM_NAME} home`} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SPLASH_MARK.light} alt="" width={40} height={39} className="block h-9 w-auto md:h-10" />
              <Wordmark className="h-[18px] md:h-5" />
            </Link>
            <nav className="flex items-center gap-2 md:gap-3">
              <Link href="/auth/login" className="flex h-9.5 items-center rounded-sm px-3 text-ui-md text-sand-25/80 no-underline transition-colors hover:bg-white/8 hover:text-sand-25">
                Sign in
              </Link>
              <Link href="/auth/signup" className={`${BUTTON_SM} ${PRIMARY}`}>
                Join us
              </Link>
            </nav>
          </div>
        </header>

        <section className="relative bg-sand-950 pt-12 text-sand-25 md:pt-[clamp(48px,6vw,96px)]">
          <div className={`mx-auto flex max-w-[1024px] flex-col items-center gap-5 text-center ${GUTTER}`}>
            <h1 className="m-0 font-serif text-[32px]/[1.08] md:text-[clamp(36px,5.4vw,78px)]/[1.05] font-semibold tracking-[-0.015em] text-balance">
              The largest collection of books online for <span className="text-brand-400">Pan-Africanists</span>.
            </h1>
            <p className="m-0 font-serif text-[17px]/[1.6] text-sand-25/68 md:text-[20px]/[1.7]">{SUB}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <Link href="/library" className={`${BUTTON} ${PRIMARY}`}>
                Browse the library
              </Link>
              <Link href="/auth/signup" className={`${BUTTON} ${INVERSE}`}>
                Join us
              </Link>
            </div>
          </div>
          <div
            id="cover-wall"
            aria-hidden="true"
            className="relative mt-10 flex flex-col gap-3 pb-9 [mask-image:linear-gradient(90deg,transparent_0,#000_8%,#000_92%,transparent_100%)] md:mt-[clamp(40px,5vw,72px)] md:gap-[clamp(12px,1.4vw,20px)] md:pb-[clamp(36px,3.6vw,52px)]"
          >
            {view.wall.map((row, i) => (
              <div key={i} className="overflow-hidden">
                <div
                  className={`landing-drift flex w-max gap-3 pt-2 will-change-transform md:gap-[clamp(12px,1.4vw,20px)] ${DRIFT[i].reverse ? "[animation-direction:reverse]" : ""}`}
                  style={{ ["--drift" as string]: `${DRIFT[i].s}s` }}
                >
                  {[...row, ...row].map((b, k) => (
                    <Cover key={`${b.id}-${k}`} book={b} link={false} className="w-[clamp(84px,9.5vw,140px)] flex-none" shadow="shadow-[0_10px_28px_rgba(0,0,0,0.5)]" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="voices" className="px-4 py-12 md:px-[clamp(16px,4vw,56px)] md:py-[clamp(48px,5vw,88px)]">
          <div className={`${WRAP} flex flex-col gap-5.5 md:gap-[clamp(22px,2.6vw,36px)]`}>
            <div className="flex max-w-[760px] flex-col gap-2 px-1">
              <span className={`${EYEBROW} text-[var(--color-app-brand)]`}>Listen</span>
              <h2 className={SECTION_TITLE}>Every book, read aloud.</h2>
              <p className={`${SECTION_LINE} text-[var(--color-app-text-secondary)]`}>Choose from 12 curated African voices.</p>
            </div>
            <Voices book={view.passage} />
          </div>
        </section>

        <section className={`border-y border-[var(--color-app-border)] bg-[var(--color-app-surface-muted)] py-12 md:py-[clamp(48px,6vw,96px)] ${GUTTER}`}>
          <div className="mx-auto flex max-w-[1024px] flex-col items-center gap-5.5 text-center md:gap-[clamp(22px,2.6vw,36px)]">
            <div className="flex max-w-[760px] flex-col gap-2">
              <span className={`${EYEBROW} text-[var(--color-app-text-muted)]`}>An initiative of the</span>
              <h2 className={SECTION_TITLE}>Movement for African Emancipation</h2>
            </div>
            <span className={`${EYEBROW} -mb-2 text-[var(--color-app-brand)] md:-mb-3`}>Our principles</span>
            <ol className="m-0 w-full max-w-[600px] list-none border-b border-[var(--color-app-border)] p-0 text-left">
              {PRINCIPLES.map((p, i) => (
                <li key={p} className="flex items-baseline gap-4 border-t border-[var(--color-app-border)] py-3 md:py-3.5">
                  <span className="w-6 flex-none text-ui-sm tabular-nums text-[var(--color-app-text-muted)]">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-serif text-[17px]/[1.3] font-semibold md:text-[20px]/[1.3]">{p}</span>
                </li>
              ))}
            </ol>
            <div>
              <Link href={PRINCIPLES_HREF} className={`${BUTTON} ${PRIMARY}`}>
                Read our principles
              </Link>
            </div>
          </div>
        </section>

        {view.featured.length > 0 && (
          <section className={`py-12 md:py-[clamp(48px,5vw,88px)] ${GUTTER}`}>
            <div className={`${WRAP} flex flex-col gap-5.5`}>
              <h2 className={SECTION_TITLE}>Featured</h2>
              <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-[clamp(32px,4vw,64px)]">
                <div className="flex items-center gap-5 sm:gap-8">
                  <Cover book={lead} className="w-[40%] max-w-[240px] flex-none sm:w-[clamp(180px,17vw,240px)]" shadow="shadow-lg" />
                  <div className="flex min-w-0 flex-col gap-3">
                    <span className={`${EYEBROW} text-[var(--color-app-brand)]`}>Editors’ pick</span>
                    <h3 className="m-0 font-serif text-[18px]/[1.2] md:text-[clamp(20px,2.4vw,32px)]/[1.15] font-semibold text-balance">
                      <Link href={`/library/${lead.slug}`} className="text-current no-underline hover:underline">
                        {lead.title}
                      </Link>
                    </h3>
                    {lead.author && <span className="text-ui-sm text-[var(--color-app-text-secondary)]">{lead.author}</span>}
                    {lead.blurb && <p className="m-0 line-clamp-3 text-reading-sm sm:line-clamp-5 text-[var(--color-app-text-secondary)]">{lead.blurb}</p>}
                    <div className="pt-1">
                      <Link href={`/library/${lead.slug}`} className={`${BUTTON_SM} ${PRIMARY}`}>
                        Start reading
                      </Link>
                    </div>
                  </div>
                </div>
                {rest.length > 0 && (
                  <div className="grid grid-cols-4 gap-3 md:gap-[clamp(12px,1.4vw,20px)]">
                    {rest.map((b) => (
                      <Cover key={b.id} book={b} className="w-full" shadow="shadow-md" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {view.mostRead.length > 0 && (
          <section className={`border-y border-[var(--color-app-border)] bg-[var(--color-app-surface-muted)] py-10 md:py-[clamp(40px,5vw,80px)] ${GUTTER}`}>
            <div className={`${WRAP} flex flex-col gap-5.5`}>
              <div className="flex items-end justify-between gap-4">
                <h2 className={SECTION_TITLE}>Most read</h2>
                <span className="pb-1 text-ui-sm whitespace-nowrap text-[var(--color-app-text-muted)]">This week</span>
              </div>
              <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-x-[clamp(24px,4vw,64px)] p-0">
                {view.mostRead.map((b) => (
                  <li key={b.id} className="border-t border-[var(--color-app-border)]">
                    <Link href={`/library/${b.slug}`} className="flex items-center gap-3 py-3 text-[var(--reader-text)] no-underline hover:text-[var(--color-app-brand)] md:gap-[clamp(14px,1.6vw,22px)] md:py-3.5">
                      <span className="w-12 flex-none md:w-[clamp(54px,5vw,72px)]">
                        <Cover book={b} link={false} className="w-full" shadow="shadow-sm" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                        <span className="line-clamp-2 font-serif text-[16px]/[1.25] font-semibold md:text-[18px]/[1.25]">{b.title}</span>
                        {b.author && <span className="truncate text-ui-sm text-[var(--color-app-text-secondary)]">{b.author}</span>}
                        <span className="text-ui-caption text-[var(--color-app-text-muted)]">{b.readers.toLocaleString("en")} currently reading</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {view.shelves.length > 0 && (
          <>
            <section className={`pt-10 md:pt-[clamp(40px,5vw,72px)] ${GUTTER}`}>
              <div className={`${WRAP} flex items-end justify-between gap-4`}>
                <h2 className={SECTION_TITLE}>Library</h2>
                <Link href="/library" className="pb-1 text-ui-sm whitespace-nowrap md:text-ui-md text-[var(--color-app-brand)] no-underline hover:underline">
                  Browse all
                </Link>
              </div>
            </section>
            {view.shelves.map((s, i) => (
              <Shelf key={s.category} title={s.title} line={s.line} href={`/library?q=${slugifyCategory(s.category)}`} dark={i % 2 === 1}>
                {s.books.map((b) => (
                  <div key={b.id} className={`flex-none snap-start ${SHELF_COVER[i % 2]}`}>
                    <Cover book={b} className="w-full" shadow={i % 2 === 1 ? "shadow-[0_14px_30px_rgba(0,0,0,0.5)]" : "shadow-md"} />
                  </div>
                ))}
              </Shelf>
            ))}
          </>
        )}

        <StudyTogether live={view.live} groups={view.groups} samples={view.samples} />

        <section className={`flex flex-col items-center gap-6 bg-sand-950 py-14 text-center text-sand-25 md:py-[clamp(56px,7vw,112px)] ${GUTTER}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SPLASH_MARK.light} alt="" width={64} height={62} className="h-auto w-16" />
          <h2 className="m-0 max-w-[820px] font-serif text-[28px]/[1.1] md:text-[clamp(32px,4.4vw,64px)]/[1.08] font-semibold text-balance">Arise for Freedom</h2>
          <p className={`${SECTION_LINE} text-sand-25/68`}>Read with Africans across the continent and the diaspora.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/auth/signup" className={`${BUTTON} ${PRIMARY}`}>
              Join us
            </Link>
            <Link href="/library" className={`${BUTTON} ${INVERSE}`}>
              Browse the library
            </Link>
          </div>
        </section>

        <footer className={`flex flex-col items-center gap-4 border-t border-[var(--color-app-border)] py-6 text-center md:flex-row md:flex-wrap md:justify-between md:text-left ${GUTTER}`}>
          <Wordmark className="h-4" />
          <nav className="flex flex-wrap justify-center gap-5 text-ui-sm">
            <Link href="/library" className="text-[var(--color-app-text-secondary)] no-underline hover:underline">
              Library
            </Link>
            <Link href={PRINCIPLES_HREF} className="text-[var(--color-app-text-secondary)] no-underline hover:underline">
              Principles
            </Link>
          </nav>
          <span className="text-ui-caption text-[var(--color-app-text-muted)]">
            {BRAND_TAGLINE}
          </span>
        </footer>
      </div>
    </>
  );
}

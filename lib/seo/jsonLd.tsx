import { appIconSrc } from "@/lib/config/brand-assets";
import { PLATFORM_NAME, PLATFORM_URL } from "@/lib/config/platform";
import { LIVE_SOCIALS } from "@/lib/config/socials";

// schema.org structured data (seo-spec.md T9), shared by every public page.

/**
 * Ominira's other profiles: the Wikidata item (seo-spec §7) and the social
 * accounts (lib/config/socials). It goes into the home page's Organization.
 */
const WIKIDATA = "https://www.wikidata.org/wiki/Q142143474";
export const ORG_SAME_AS: string[] = [WIKIDATA, ...LIVE_SOCIALS.map((s) => s.url)];

/** One or more schema.org objects as a JSON-LD script tag. */
export function JsonLd({ data }: { data: object | object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** A BreadcrumbList from [name, path] pairs, the page itself last. */
export function breadcrumbs(items: [name: string, path: string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${PLATFORM_URL}${path}` })),
  };
}

/** The home page's Organization + WebSite. */
export function siteJsonLd(description: string) {
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${PLATFORM_URL}/#organization`,
    name: PLATFORM_NAME,
    alternateName: `Project ${PLATFORM_NAME}`,
    url: PLATFORM_URL,
    logo: `${PLATFORM_URL}${appIconSrc(512)}`,
    description,
    ...(ORG_SAME_AS.length && { sameAs: ORG_SAME_AS }),
  };
  const site = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${PLATFORM_URL}/#website`,
    name: PLATFORM_NAME,
    url: PLATFORM_URL,
    description,
    inLanguage: "en",
    publisher: { "@id": `${PLATFORM_URL}/#organization` },
  };
  return [org, site];
}

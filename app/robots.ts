import type { MetadataRoute } from "next";
import { PLATFORM_URL } from "@/lib/config/platform";

// Without this, /robots.txt rendered the HTML not-found page with a 200,
// which link-preview crawlers like Twitterbot may not read as "allow".
// /read/ and /reader/ are crawlable so search engines can see their noindex
// (blocked, Google listed them without content: seo-spec.md T1). Their
// server HTML holds no book text, and Google doesn't render a noindex page,
// so it never fetches the text from the CDN. The API stays blocked. Advisory
// only; the Vercel Firewall and Cloudflare enforce it (bandwidth-spec.md step 3).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: `${PLATFORM_URL}/sitemap.xml`,
  };
}

// Ominira's social accounts: the landing footer's icons, the About page and
// the home page's Organization.sameAs (seo-spec T9). An entry without a url
// isn't shown.

export type Social = { name: "Instagram" | "X" | "TikTok" | "Facebook"; url?: string };

export const SOCIALS: Social[] = [
  { name: "Instagram", url: "https://www.instagram.com/projectominira01/" },
  { name: "X", url: "https://x.com/ProjectOminira" },
  { name: "TikTok" },
  { name: "Facebook" },
];

export const LIVE_SOCIALS = SOCIALS.filter((s): s is Required<Social> => !!s.url);

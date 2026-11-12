import { ImageResponse } from "next/og";
import { BRAND_BG } from "@/lib/config/brand-assets";
import { OG_ACCENT, OG_SIZE, brandImage, loadCover } from "@/lib/config/og";
import { PLATFORM_HOST } from "@/lib/config/platform";
import { resolveBookCoverSrc } from "@/lib/materials/image";
import { getReadingList, monthLabel } from "@/lib/readingLists/lists";

// A reading list's share card (seo-spec C1): the title, the month and a fan
// of its first covers, like the book cards.
export const alt = "Reading list on Ominira";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const l = await getReadingList((await params).slug);
  const [covers, wordmark] = await Promise.all([
    Promise.all((l?.entries ?? []).slice(0, 4).map((e) => loadCover(resolveBookCoverSrc(e.book)))),
    brandImage("wordmark-3.png"),
  ]);
  const drawn = covers.filter((c): c is string => !!c);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 56, padding: "0 72px", background: BRAND_BG.light, color: "#1c1917" }}>
        {drawn.length > 0 && (
          <div style={{ display: "flex", width: 150 + drawn.length * 70 }}>
            {drawn.map((c, i) => (
              <img
                key={i}
                src={c}
                width={220}
                height={330}
                alt=""
                style={{ objectFit: "cover", borderRadius: 6, marginLeft: i ? -150 : 0, boxShadow: "0 10px 28px rgba(0,0,0,0.25)", border: `3px solid ${BRAND_BG.light}` }}
              />
            ))}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 20 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: OG_ACCENT }}>
            {l ? `Reading list · ${monthLabel(l.day)}` : "Reading lists"}
          </div>
          <div style={{ display: "block", fontSize: 58, fontWeight: 700, lineHeight: 1.1, lineClamp: 4 }}>{l?.title ?? "Ominira"}</div>
          {l && <div style={{ fontSize: 30, color: "#57534e" }}>{l.entries.length} books</div>}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
            <img src={wordmark} width={240} height={40} alt="" />
            <div style={{ marginTop: 10, fontSize: 28, fontWeight: 700, color: OG_ACCENT }}>{PLATFORM_HOST}</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}

import type { Metadata } from "next";
import { adminQuotes } from "@/lib/quotes/directory";
import { pageNumber } from "@/lib/quotes/page";
import QuotesAdminView from "./QuotesAdminView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quotes",
  robots: { index: false, follow: false },
};

/** The quote directory's quotes, to hide a weak or out-of-context one
 * (seo-spec C4: quotes publish without review; editors hide afterwards). */
export default async function AdminQuotesPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string; page?: string }> }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const hidden = params.show === "hidden";
  const page = pageNumber(params.page);
  const result = await adminQuotes({ q, hidden, page });
  return <QuotesAdminView q={q} hidden={hidden} page={page} {...result} />;
}

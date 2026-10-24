import type { Metadata } from "next";
import { headers } from "next/headers";
import { countMembers, countNewQuotes, getToday, listDays, listSets } from "@/lib/passage/sets";
import PassageAdminView, { type Tab } from "./PassageAdminView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Passages",
  robots: { index: false, follow: false },
};

export default async function AdminPassagePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const initial: Tab = tab === "history" ? "history" : "sets";
  // The open tab's first page comes with the page; the others load when opened.
  const [today, newQuotes, members, firstSets, firstDays] = await Promise.all([
    getToday(),
    countNewQuotes(),
    countMembers(),
    initial === "sets" ? listSets({ cursor: null }) : null,
    initial === "history" ? listDays({ cursor: null }) : null,
  ]);
  // The connector link (passage-spec §6.2), on whichever host this is.
  const token = process.env.PASSAGE_CONNECTOR_TOKEN?.trim();
  const h = await headers();
  const connectorUrl = token ? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/api/mcp/${token}` : null;
  return <PassageAdminView connectorUrl={connectorUrl} tab={initial} today={today} newQuotes={newQuotes} members={members} firstSets={firstSets} firstDays={firstDays} />;
}

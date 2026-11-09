import type { Metadata } from "next";
import { getCalendar } from "@/lib/passage/calendar";
import { countMembers, countNewQuotes, listDays, listSets } from "@/lib/passage/sets";
import PassageAdminView, { type Tab } from "./PassageAdminView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Passages",
  robots: { index: false, follow: false },
};

export default async function AdminPassagePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const initial: Tab = tab === "history" || tab === "review" ? tab : "calendar";
  // The calendar always comes with the page; the open tab's first page too,
  // the others load when opened.
  const [calendar, newQuotes, members, firstSets, firstDays] = await Promise.all([
    getCalendar(),
    countNewQuotes(),
    countMembers(),
    initial === "review" ? listSets({ cursor: null }) : null,
    initial === "history" ? listDays({ cursor: null }) : null,
  ]);
  return <PassageAdminView tab={initial} calendar={calendar} newQuotes={newQuotes} members={members} firstSets={firstSets} firstDays={firstDays} />;
}

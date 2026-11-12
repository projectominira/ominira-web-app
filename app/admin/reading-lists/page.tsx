import type { Metadata } from "next";
import { adminReadingLists } from "@/lib/readingLists/lists";
import ReadingListsAdminView from "./ReadingListsAdminView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reading lists",
  robots: { index: false, follow: false },
};

/** Monthly reading lists the connector drafted, to edit and approve (seo-spec C1). */
export default async function AdminReadingListsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const approved = (await searchParams).show === "approved";
  const lists = await adminReadingLists(approved ? "approved" : "draft");
  return <ReadingListsAdminView approved={approved} lists={lists} />;
}

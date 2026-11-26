import type { Metadata } from "next";
import { adminReadingLists } from "@/lib/readingLists/lists";
import ReadingListsAdminView from "./ReadingListsAdminView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reading lists",
  robots: { index: false, follow: false },
};

/** Monthly reading lists the AI wrote, to edit or take off the site (seo-spec C1). */
export default async function AdminReadingListsPage() {
  return <ReadingListsAdminView lists={await adminReadingLists()} />;
}

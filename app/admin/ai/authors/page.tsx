import type { Metadata } from "next";
import { adminAuthors } from "@/lib/authors/authors";
import AuthorsAdminView from "./AuthorsAdminView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Authors",
  robots: { index: false, follow: false },
};

/** Author pages the AI wrote, to edit or take off the site (seo-spec C2). */
export default async function AdminAuthorsPage() {
  return <AuthorsAdminView authors={await adminAuthors()} />;
}

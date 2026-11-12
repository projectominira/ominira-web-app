import type { Metadata } from "next";
import { adminAuthors } from "@/lib/authors/authors";
import AuthorsAdminView from "./AuthorsAdminView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Authors",
  robots: { index: false, follow: false },
};

/** Author pages the connector drafted, to edit and approve (seo-spec C2). */
export default async function AdminAuthorsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const approved = (await searchParams).show === "approved";
  const authors = await adminAuthors(approved ? "approved" : "draft");
  return <AuthorsAdminView approved={approved} authors={authors} />;
}

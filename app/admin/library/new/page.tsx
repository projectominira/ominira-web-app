import type { Metadata } from "next";
import AdminAddBooksView from "./AdminAddBooksView";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add books",
  robots: { index: false, follow: false },
};

export default async function AdminAddBooksPage({ searchParams }: { searchParams: Promise<{ drive?: string }> }) {
  // `?drive=<folder link>` prefills the link field (a reader's suggestion, /admin/library).
  const { drive } = await searchParams;
  // Public titles and source-file sizes already in the library, so an import
  // can skip them up front. The size is the stored file's exact byte count,
  // which catches the same file under a different name or parsed title.
  // Paged: a query returns at most 1,000 rows, and the library is past that.
  const data: { title: string; file_size_bytes: number | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await getSupabaseAdminClient()
      .from("materials")
      .select("title, file_size_bytes")
      .eq("visibility", "public")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    data.push(...page);
    if (page.length < 1000) break;
  }
  return (
    <AdminAddBooksView
      libraryTitles={data.map((m) => m.title)}
      librarySizes={data.flatMap((m) => (m.file_size_bytes ? [m.file_size_bytes] : []))}
      initialLink={drive ?? ""}
    />
  );
}

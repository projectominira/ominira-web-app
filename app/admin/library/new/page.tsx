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
  // Public titles already in the library, so an import can skip them up front.
  const { data } = await getSupabaseAdminClient().from("materials").select("title").eq("visibility", "public");
  return <AdminAddBooksView libraryTitles={(data ?? []).map((m) => m.title)} initialLink={drive ?? ""} />;
}

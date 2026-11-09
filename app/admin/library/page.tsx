import type { Metadata } from "next";
import LibraryAdminView from "./LibraryAdminView";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { getCategories } from "@/lib/categories/config";
import { parseGoogleMetaData, parseOpenLibraryMetaData } from "@/lib/materials/providerMeta";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Library admin",
  robots: { index: false, follow: false },
};

export default async function AdminLibraryPage() {
  const admin = getSupabaseAdminClient();
  const [{ data: books, error: booksError }, categories, { count: pendingSuggestions }] = await Promise.all([
    admin
      .from("materials")
      .select(
        "id, slug, title, author, description, material_type, file_size_bytes, visibility, cover_url, thumbnail_url, categories, status, updated_at, google_meta_data, openlibrary_meta_data, cover_source"
      )
      .order("updated_at", { ascending: false }),
    getCategories(),
    admin
      .from("pending_materials")
      .select("id", { count: "exact", head: true })
      .eq("submission_type", "suggestion")
      .eq("status", "pending"),
  ]);

  if (booksError) throw new Error(`Could not load library materials: ${booksError.message}`);


  // Every material, whatever its type or visibility — admins need to reach
  // members' private uploads too (a heavy file, a takedown).
  return (
    <>
      <LibraryAdminView
        categories={categories}
        pendingSuggestions={pendingSuggestions ?? 0}
        books={(books ?? []).map(({ google_meta_data, openlibrary_meta_data, cover_source, material_type, file_size_bytes, ...book }) => {
          const google = parseGoogleMetaData(google_meta_data);
          const openlibrary = parseOpenLibraryMetaData(openlibrary_meta_data);
          return {
            ...book,
            categories: (book.categories as string[]) ?? [],
            status: book.status === "published" ? "published" : "unpublished",
            googleCoverUrl: google.coverUrl,
            googleThumbnailUrl: google.thumbnailUrl,
            openlibraryCoverUrl: openlibrary.coverUrl,
            openlibraryThumbnailUrl: openlibrary.thumbnailUrl,
            coverSource: cover_source,
            materialType: material_type,
            fileSizeBytes: file_size_bytes,
          };
        })}
      />
    </>
  );
}

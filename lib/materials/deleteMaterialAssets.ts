import { deletePrefix, putObject } from "@/lib/storage/r2";
import { slugMarker } from "./uniqueSlug";

/**
 * Removes everything a material owns — its whole `books/<slug>/` folder in
 * R2 — except the slug's `.taken` marker, so the slug is never handed out
 * again: the files were cached as immutable, and a new book at the same keys
 * would be served the old one's bytes. Best-effort: called after the
 * `materials` row is already gone (the DB delete is what makes a book
 * disappear), so a failure here leaves orphaned files rather than reversing
 * the delete. A renamed book's files stay in the folder of the slug it was
 * uploaded under, so `oldSlugs` (materials.old_slugs) are cleared too.
 */
export async function deleteMaterialAssets(slug: string, oldSlugs: string[] = []): Promise<{ errors: string[] }> {
  const results = await Promise.all(
    [slug, ...oldSlugs].map(async (s) => {
      const folder = `books/${s}/`;
      try {
        const failed = await deletePrefix(folder);
        await putObject(slugMarker(s), "", "text/plain");
        return failed.map((key) => `could not remove ${key}`);
      } catch (err) {
        return [`${folder}: ${(err as Error).message}`];
      }
    })
  );
  return { errors: results.flat() };
}

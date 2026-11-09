import type { Metadata } from "next";
import GroupsAdminView from "./GroupsAdminView";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Study groups admin",
  robots: { index: false, follow: false },
};

export default async function AdminGroupsPage() {
  const admin = getSupabaseAdminClient();
  const [{ data: groups, error }, { data: members }, { data: current }] = await Promise.all([
    admin.from("groups").select("id, slug, name, is_private, created_by, created_at").order("created_at", { ascending: false }),
    admin.from("group_members").select("group_id"),
    admin.from("group_books").select("group_id, material_id").eq("status", "current"),
  ]);
  if (error) throw new Error(`Could not load study groups: ${error.message}`);

  const creatorIds = [...new Set((groups ?? []).map((g) => g.created_by).filter((id): id is string => !!id))];
  const bookIds = [...new Set((current ?? []).map((b) => b.material_id))];
  const [{ data: creators }, { data: books }] = await Promise.all([
    creatorIds.length ? admin.from("readers").select("id, pseudonym").in("id", creatorIds) : { data: [] },
    bookIds.length ? admin.from("materials").select("id, title").in("id", bookIds) : { data: [] },
  ]);

  const memberCounts = new Map<string, number>();
  for (const { group_id } of members ?? []) memberCounts.set(group_id, (memberCounts.get(group_id) ?? 0) + 1);
  const pseudonyms = new Map((creators ?? []).map((r) => [r.id, r.pseudonym]));
  const titles = new Map((books ?? []).map((b) => [b.id, b.title]));
  const reading = new Map((current ?? []).map((b) => [b.group_id, titles.get(b.material_id) ?? null]));

  return (
    <GroupsAdminView
      groups={(groups ?? []).map((g) => ({
        id: g.id,
        slug: g.slug,
        name: g.name,
        isPrivate: g.is_private,
        members: memberCounts.get(g.id) ?? 0,
        reading: reading.get(g.id) ?? null,
        createdBy: g.created_by ? (pseudonyms.get(g.created_by) ?? null) : null,
        createdAt: g.created_at,
      }))}
    />
  );
}

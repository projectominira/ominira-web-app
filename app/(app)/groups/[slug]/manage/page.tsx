import type { Metadata } from "next";
import GroupManageView from "@/app/components/groups/GroupManageView";
import { getCategories } from "@/lib/categories/config";

export const metadata: Metadata = { title: "Manage group", robots: { index: false } };

/** Moderators only; GroupManageView sends anyone else back to the group.
 * Categories feed the Reading list tab's upload sheet. */
export default async function GroupManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, categories] = await Promise.all([params, getCategories()]);
  return <GroupManageView slug={slug} categories={categories} />;
}

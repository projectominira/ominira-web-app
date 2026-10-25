import type { Metadata } from "next";
import GroupManageView from "@/app/components/groups/GroupManageView";
import { getCategories } from "@/lib/categories/config";

export const metadata: Metadata = { title: "Manage group", robots: { index: false } };

/** Moderators only; GroupManageView sends anyone else back to the group.
 * Categories feed the Reading list tab's upload sheet; `?tab=` opens a tab. */
export default async function GroupManagePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ slug }, { tab }, categories] = await Promise.all([params, searchParams, getCategories()]);
  return <GroupManageView slug={slug} categories={categories} tab={tab} />;
}

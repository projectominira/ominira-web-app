import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findGroup } from "@/lib/groups/membership";
import { PLATFORM_URL } from "@/lib/config/platform";
import GroupView from "@/app/components/groups/GroupView";

// generateMetadata and the page both need the group; load it once per request.
const getGroup = cache(findGroup);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const group = await getGroup(slug);
  if (!group) return { title: "Not found" };
  const url = `${PLATFORM_URL}/groups/${slug}`;
  return {
    title: group.name,
    description: group.description || undefined,
    alternates: { canonical: url },
    openGraph: { title: group.name, description: group.description || undefined, url },
  };
}

// Client-rendered (GroupView): the room, Join and the moderators' controls
// depend on the viewer, who only lives client-side.
// `?tab=about` opens with Group info.
export default async function GroupPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { slug } = await params;
  const { tab } = await searchParams;
  if (!(await getGroup(slug))) notFound();
  return <GroupView slug={slug} initialAbout={tab === "about"} />;
}

import type { Metadata } from "next";
import { adminTopics } from "@/lib/topics/guides";
import TopicsAdminView from "./TopicsAdminView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Topics",
  robots: { index: false, follow: false },
};

/** Topic guides the connector drafted, to edit and approve (seo-spec C3). */
export default async function AdminTopicsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const approved = (await searchParams).show === "approved";
  const topics = await adminTopics(approved ? "approved" : "draft");
  return <TopicsAdminView approved={approved} topics={topics} />;
}

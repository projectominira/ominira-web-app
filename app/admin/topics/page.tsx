import type { Metadata } from "next";
import { adminTopics } from "@/lib/topics/guides";
import TopicsAdminView from "./TopicsAdminView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Topics",
  robots: { index: false, follow: false },
};

/** Topic guides the connector published, to edit or remove (seo-spec C3). */
export default async function AdminTopicsPage() {
  return <TopicsAdminView topics={await adminTopics()} />;
}

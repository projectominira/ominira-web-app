import type { ReactNode } from "react";
import AdminPageHeader from "@/app/admin/AdminPageHeader";
import AdminTabs from "@/app/admin/AdminTabs";

const TABS = [
  { href: "/admin/ai/authors", label: "Authors" },
  { href: "/admin/ai/topics", label: "Topics" },
  { href: "/admin/ai/reading-lists", label: "Reading lists" },
  { href: "/admin/ai/quotes", label: "Quotes" },
  { href: "/admin/ai/connector", label: "Connector" },
];

/** Everything the AI writes for the site goes live at once; editors take
 * a page off the site (and put it back) here. */
export default function AiLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminPageHeader title="AI" subtitle="What your AI has published. Edit anything, or take it off the site." />
      <AdminTabs label="AI" tabs={TABS} />
      {children}
    </>
  );
}

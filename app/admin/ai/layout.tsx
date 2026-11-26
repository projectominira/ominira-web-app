import type { ReactNode } from "react";
import AdminPageHeader from "@/app/admin/AdminPageHeader";
import AiTabs from "./AiTabs";

/** Everything the AI writes for the site goes live at once; editors take
 * a page off the site (and put it back) here. */
export default function AiLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminPageHeader title="AI" subtitle="What your AI has published. Edit anything, or take it off the site." />
      <AiTabs />
      {children}
    </>
  );
}

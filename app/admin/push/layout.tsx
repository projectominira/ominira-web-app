import type { ReactNode } from "react";
import AdminPageHeader from "@/app/admin/AdminPageHeader";
import AdminTabs from "@/app/admin/AdminTabs";

const TABS = [
  { href: "/admin/push", label: "New", exact: true },
  { href: "/admin/push/sent", label: "Sent" },
];

/** Broadcast opens on a new one; what's gone out is under Sent. */
export default function BroadcastLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminPageHeader title="Broadcast" subtitle="Send to members by app notification and email." />
      <AdminTabs label="Broadcast" tabs={TABS} />
      {children}
    </>
  );
}

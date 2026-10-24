"use client";

import { useRouter } from "next/navigation";
import { Library, Quote, Send, Users } from "lucide-react";
import RowMenu from "@/app/components/groups/RowMenu";

const BUTTON =
  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border border-[var(--reader-border)] bg-transparent text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]";

/** The dashboard's ⋯ menu: the other admin screens. */
export default function AdminMenu() {
  const router = useRouter();
  const go = (href: string) => () => router.push(href);

  return (
    <RowMenu
      label="Admin menu"
      buttonClassName={BUTTON}
      items={[
        { label: "Library", icon: <Library size={14} />, onClick: go("/admin/library") },
        { label: "Readers", icon: <Users size={14} />, onClick: go("/admin/readers") },
        { label: "Passages", icon: <Quote size={14} />, onClick: go("/admin/passage") },
        { label: "Send notification", icon: <Send size={14} />, onClick: go("/admin/push") },
      ]}
    />
  );
}

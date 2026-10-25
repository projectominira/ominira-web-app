import type { ReactNode } from "react";
import UnderlineTabs from "@/app/components/UnderlineTabs";

/** Which rooms the chat list shows. */
export type ChatFilter = "all" | "groups" | "books" | "unread";

/** The rows of one kind that `filter` keeps. */
export function shown<T extends { unread: number }>(rows: T[], kind: "groups" | "books", filter: ChatFilter): T[] {
  if (filter === "all" || filter === kind) return rows;
  return filter === "unread" ? rows.filter((r) => r.unread > 0) : [];
}

const hasUnread = (r: { unread: number }) => r.unread > 0;

/** The filter tabs: All, each kind you have, and Unread with its count.
 * Nothing when only All would show. */
export default function ChatTabs({
  groups,
  rooms,
  value,
  onChange,
}: {
  groups: { unread: number }[];
  rooms: { unread: number }[];
  value: ChatFilter;
  onChange: (filter: ChatFilter) => void;
}) {
  const unread = groups.filter(hasUnread).length + rooms.filter(hasUnread).length;
  const tabs: { value: ChatFilter; label: ReactNode }[] = [{ value: "all", label: "All" }];
  if (groups.length) tabs.push({ value: "groups", label: "Groups" });
  if (rooms.length) tabs.push({ value: "books", label: "Books" });
  if (unread)
    tabs.push({
      value: "unread",
      label: (
        <>
          Unread
          <span className="ml-1.5 h-4 min-w-4 rounded-full bg-brand-500 px-1.5 text-center text-[10px] font-bold text-sand-25">{unread}</span>
        </>
      ),
    });
  if (tabs.length <= 2) return null;
  return <UnderlineTabs options={tabs} value={value} onChange={onChange} />;
}

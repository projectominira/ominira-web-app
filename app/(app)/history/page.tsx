import type { Metadata } from "next";
import HistoryView from "@/app/components/history/HistoryView";

export const metadata: Metadata = {
  title: "Reading history",
  description: "Your reading on Ominira, day by day: the time you've read, your streaks and the books you spent it on.",
};

export default function HistoryPage() {
  return <HistoryView />;
}

import type { Metadata } from "next";
import HomeScreen from "@/app/components/home/HomeScreen";

export const metadata: Metadata = {
  title: "Home",
  description: "Pick up where you left off, keep your reading streak, find books for you and read with your study groups.",
  // Signed in only (HomeScreen sends anyone else to the landing page), so
  // a crawler would see an empty page: "/" is what's indexed.
  robots: { index: false, follow: true },
};

export default function HomePage() {
  return <HomeScreen />;
}

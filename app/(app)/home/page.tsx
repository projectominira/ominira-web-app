import type { Metadata } from "next";
import HomeScreen from "@/app/components/home/HomeScreen";

export const metadata: Metadata = {
  title: "Home",
  description: "Join a reading room, pick up where you left off, keep your reading streak and see the featured books.",
};

export default function HomePage() {
  return <HomeScreen />;
}

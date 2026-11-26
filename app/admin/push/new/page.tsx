import { redirect } from "next/navigation";

/** Broadcast now opens on a new one. */
export default async function AdminNewBroadcastPage({ searchParams }: { searchParams: Promise<{ reuse?: string }> }) {
  const { reuse } = await searchParams;
  redirect(reuse ? `/admin/push?reuse=${encodeURIComponent(reuse)}` : "/admin/push");
}

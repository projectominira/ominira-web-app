import type { Metadata } from "next";
import { headers } from "next/headers";
import { getBrief } from "@/lib/passage/calendar";
import ConnectorView from "./ConnectorView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Connector",
  robots: { index: false, follow: false },
};

/** The Ominira connector (passage-spec §6.2): its link, on whichever host
 * this is, and how editors use it from their own AI. */
export default async function AdminConnectorPage() {
  const token = process.env.PASSAGE_CONNECTOR_TOKEN?.trim();
  const [h, brief] = await Promise.all([headers(), getBrief()]);
  const url = token ? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/api/mcp/${token}` : null;
  return <ConnectorView url={url} brief={brief} />;
}

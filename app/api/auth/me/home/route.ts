import { NextResponse } from "next/server";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { getHomeView } from "@/lib/rooms/homeView";
import type { HomeView } from "@/lib/rooms/types";

/** `GET /api/auth/me/home`: Home in one call. Signed out,
 * the public hub (`getHomeView(null)`), since /home is the landing page. */
export async function GET(request: Request) {
  const reader = await getAuthenticatedReader(request);
  return NextResponse.json((await getHomeView(reader?.readerId ?? null)) satisfies HomeView);
}

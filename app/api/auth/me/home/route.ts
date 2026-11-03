import { NextResponse } from "next/server";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { getHomeView } from "@/lib/rooms/homeView";
import type { HomeView } from "@/lib/rooms/types";

/** `GET /api/auth/me/home`: Home in one call, signed in only. */
export async function GET(request: Request) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return NextResponse.json({ error: "Sign in to see Home" }, { status: 401 });
  return NextResponse.json((await getHomeView(reader.readerId)) satisfies HomeView);
}

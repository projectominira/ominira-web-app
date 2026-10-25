import { NextResponse, type NextRequest } from "next/server";
import { listSets } from "@/lib/passage/sets";

/** /admin/passage's Sets, newest first (passage-spec §3). */
export async function GET(request: NextRequest) {
  return NextResponse.json(await listSets({ cursor: request.nextUrl.searchParams.get("cursor") }));
}

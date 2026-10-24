import { NextResponse, type NextRequest } from "next/server";
import { listDays } from "@/lib/passage/sets";

/** /admin/passage's History: every passage of the day, newest first. */
export async function GET(request: NextRequest) {
  return NextResponse.json(await listDays({ cursor: request.nextUrl.searchParams.get("cursor") }));
}

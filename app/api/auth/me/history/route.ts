import { NextResponse } from "next/server";
import { getAuthenticatedReader } from "@/lib/auth/session";
import { unauthorized, validationError } from "@/lib/api/errors";
import { getReadingHistory } from "@/lib/streaks/record";

/** `GET /api/auth/me/history?year=`: a year of the reader's reading
 * (/history), this year by default. */
export async function GET(request: Request) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  const param = new URL(request.url).searchParams.get("year");
  const year = param === null ? new Date().getUTCFullYear() : Number(param);
  if (!Number.isInteger(year) || year < 2000 || year > 3000) return validationError("Pick a year.", "year");
  return NextResponse.json(await getReadingHistory(reader.readerId, year));
}

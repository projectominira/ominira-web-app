import { NextResponse } from "next/server";

/**
 * Google Drive access for the admin import (lib/materials/googleDrive.ts),
 * so a long import never stops for a new sign-in. Google's access tokens
 * last an hour; the refresh token from one sign-in lives here, in an
 * httpOnly cookie the page can't read, and mints new access tokens on
 * request. Behind the admin PIN gate (proxy.ts), like every /api/admin route.
 *
 * POST { code }: the sign-in popup's authorization code -> access token
 * (and the refresh token into the cookie).
 * GET: a fresh access token from the cookie, or 401 when there's none.
 */
const COOKIE = "drive_refresh";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

async function exchange(params: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...params,
    }),
  });
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; refresh_token?: string } };
}

export async function POST(request: Request) {
  const { code } = (await request.json().catch(() => ({}))) as { code?: unknown };
  if (typeof code !== "string" || !code) return NextResponse.json({ error: "code is required" }, { status: 400 });
  // "postmessage" is the redirect URI for a popup sign-in's code.
  const { ok, data } = await exchange({ grant_type: "authorization_code", code, redirect_uri: "postmessage" });
  if (!ok || !data.access_token) return NextResponse.json({ error: "Google refused the sign-in." }, { status: 401 });
  const res = NextResponse.json({ accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 });
  if (data.refresh_token) {
    res.cookies.set(COOKIE, data.refresh_token, { httpOnly: true, secure: true, sameSite: "strict", path: "/api/admin/drive", maxAge: 60 * 60 * 24 * 30 });
  }
  return res;
}

export async function GET(request: Request) {
  const refresh = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`))?.[1];
  if (!refresh) return NextResponse.json({ error: "Not signed in to Google." }, { status: 401 });
  const { ok, data } = await exchange({ grant_type: "refresh_token", refresh_token: decodeURIComponent(refresh) });
  if (!ok || !data.access_token) {
    const res = NextResponse.json({ error: "Google sign-in expired." }, { status: 401 });
    res.cookies.delete({ name: COOKIE, path: "/api/admin/drive" });
    return res;
  }
  return NextResponse.json({ accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 });
}

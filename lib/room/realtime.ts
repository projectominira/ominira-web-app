import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SessionDescription, SfuResult } from "@/lib/room/types";

// Cloudflare Realtime SFU for room audio (reading-room-spec.md §8.4), behind
// app/api/rooms/[roomId]/audio. Each member's browser holds one connection to
// Cloudflare: a speaker publishes their mic once, listeners pull it. The app
// secret stays here; the browser gets its session id with a token that ties
// it to the reader and the room, so nobody can touch another's session.

const API = "https://rtc.live.cloudflare.com/v1/apps";
/** The one track a member publishes. */
export const MIC_TRACK = "mic";

export const sfuConfigured = () => !!process.env.CLOUDFLARE_REALTIME_APP_ID && !!process.env.CLOUDFLARE_REALTIME_APP_SECRET;

async function call(method: "POST" | "PUT", path: string, body?: unknown): Promise<SfuResult & { sessionId?: string }> {
  const res = await fetch(`${API}/${process.env.CLOUDFLARE_REALTIME_APP_ID}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_REALTIME_APP_SECRET}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as SfuResult & { sessionId?: string };
  if (!res.ok && !data.errorCode) data.errorCode = `http_${res.status}`;
  return data;
}

export async function newSession(): Promise<string | null> {
  const data = await call("POST", "/sessions/new");
  if (!data.sessionId) console.error("[room] SFU session failed", data.errorCode, data.errorDescription);
  return data.sessionId ?? null;
}

/** Publishes the mic on the transceiver `mid`; the answer comes back. */
export const pushMic = (session: string, offer: SessionDescription, mid: string) =>
  call("POST", `/sessions/${session}/tracks/new`, {
    sessionDescription: offer,
    tracks: [{ location: "local", mid, trackName: MIC_TRACK }],
  });

/** Pulls these publishers' mics; Cloudflare offers, the browser answers. */
export const pullMics = (session: string, publishers: string[]) =>
  call("POST", `/sessions/${session}/tracks/new`, {
    tracks: publishers.map((sessionId) => ({ location: "remote", sessionId, trackName: MIC_TRACK })),
  });

export const renegotiate = (session: string, answer: SessionDescription) =>
  call("PUT", `/sessions/${session}/renegotiate`, { sessionDescription: answer });

/** Stops pulling these (the browser stopped their transceivers in `offer`). */
export const closeTracks = (session: string, mids: string[], offer: SessionDescription) =>
  call("PUT", `/sessions/${session}/tracks/close`, { tracks: mids.map((mid) => ({ mid })), sessionDescription: offer, force: false });

function sign(readerId: string, roomId: string, session: string): string {
  return createHmac("sha256", process.env.CLOUDFLARE_REALTIME_APP_SECRET ?? "")
    .update(`room-audio:${readerId}:${roomId}:${session}`)
    .digest("base64url");
}

export const sessionToken = sign;

export function isSessionToken(readerId: string, roomId: string, session: string, token: string): boolean {
  const expected = Buffer.from(sign(readerId, roomId, session));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

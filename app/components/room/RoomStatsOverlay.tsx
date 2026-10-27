"use client";

import { useEffect, useState } from "react";
import type { AudioStats } from "@/lib/room/sfu";
import { useRoomStore } from "@/stores/room-store";

// Dev only (spec §8.10): `localStorage["ominira-room-debug"] = "1"`, then
// rejoin. The one audio connection (to Cloudflare): state, RTT, jitter,
// loss, relayed, voices arriving. getStats runs every 5 s, and only while
// this is on screen.

const POLL_MS = 5_000;

export default function RoomStatsOverlay() {
  const session = useRoomStore((s) => s.session);
  const [stats, setStats] = useState<AudioStats | null>(null);

  useEffect(() => {
    if (!session) return;
    let live = true;
    const poll = () => void session.audioStats().then((next) => live && setStats(next));
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [session]);

  return (
    <div className="pointer-events-none fixed top-2 left-2 z-[80] rounded-md bg-black/75 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-white">
      <div className="font-bold">room audio: {stats?.streams ?? 0} voices</div>
      {stats && (
        <div>
          {stats.state} · rtt {stats.rttMs ?? "–"} ms · jitter {stats.jitterMs ?? "–"} ms · lost {stats.packetsLost}
          {stats.relayed ? " · TURN" : ""}
        </div>
      )}
    </div>
  );
}

export function roomDebugEnabled(): boolean {
  try {
    return localStorage.getItem("ominira-room-debug") === "1";
  } catch {
    return false;
  }
}

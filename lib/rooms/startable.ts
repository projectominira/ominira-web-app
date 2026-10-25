import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { MATERIAL_SUMMARY_COLUMNS } from "@/lib/materials/columns";
import { toMaterialSummary } from "@/lib/materials/summary";
import { READING_NOW_MS, STRIP_MS } from "./home";
import type { RoomSuggestions } from "./types";

// "Start a room"'s suggestions (GET /api/rooms/suggestions), loaded when its
// sheet opens: every public book you're currently reading, then every one
// comrades read today, each with how many comrades read it today — they're
// invited when its room starts (lib/room/invite). Books with a room live
// now are left out: those are joined from the strip.

/** Caps on what the sheet lists; search reaches the rest of the library. */
const READING_MAX = 50;
const TODAY_MAX = 30;

const since = (ms: number) => new Date(Date.now() - ms).toISOString();

export async function getRoomSuggestions(readerId: string): Promise<RoomSuggestions> {
  const admin = getSupabaseAdminClient();
  const [mine, readers, live] = await Promise.all([
    admin
      .from("reader_activities")
      .select("material_id, updated_at")
      .eq("reader_id", readerId)
      .is("finished_at", null)
      .order("updated_at", { ascending: false })
      .limit(READING_MAX)
      .then(({ data, error }) => {
        if (error) throw error;
        return data;
      }),
    // Everyone who read each book in the last day, you included.
    admin.rpc("book_readers", { day_since: since(STRIP_MS), now_since: since(READING_NOW_MS), reader: readerId }).then(({ data, error }) => {
      if (error) throw error;
      return new Map(data.map((r) => [r.material_id, r.day]));
    }),
    admin
      .from("rooms")
      .select("material_id")
      .eq("status", "live")
      .then(({ data, error }) => {
        if (error) throw error;
        return new Set(data.map((r) => r.material_id));
      }),
  ]);

  const yours = new Set(mine.map((r) => r.material_id));
  const others = [...readers.keys()].filter((id) => !yours.has(id));
  const ids = [...yours, ...others].filter((id) => !live.has(id));
  if (ids.length === 0) return { mine: [], today: [] };
  const { data, error } = await admin.from("materials").select(MATERIAL_SUMMARY_COLUMNS).in("id", ids).eq("status", "published").eq("visibility", "public");
  if (error) throw error;
  const books = new Map(data.map((m) => [m.id, toMaterialSummary(m)]));

  const day = since(STRIP_MS);
  return {
    mine: mine.flatMap((r) => {
      const material = live.has(r.material_id) ? undefined : books.get(r.material_id);
      // The day's count includes you when you read it today.
      return material ? [{ material, readers: Math.max(0, (readers.get(r.material_id) ?? 0) - Number(r.updated_at > day)) }] : [];
    }),
    today: others
      .flatMap((id) => {
        const material = books.get(id);
        return material ? [{ material, readers: readers.get(id) ?? 0 }] : [];
      })
      .sort((a, b) => b.readers - a.readers)
      .slice(0, TODAY_MAX),
  };
}

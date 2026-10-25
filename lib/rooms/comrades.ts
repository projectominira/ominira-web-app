import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { toAvatar } from "@/lib/avatar/avatar";
import type { Comrade } from "./types";

/** Readers as rooms show them (an avatar, a name and city), by id, in one query. */
export async function comradesById(ids: string[]): Promise<Map<string, Comrade & { city: string | null }>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await getSupabaseAdminClient()
    .from("readers")
    .select("id, pseudonym, city, avatar_color, avatar_url")
    .in("id", [...new Set(ids)]);
  if (error) throw error;
  return new Map(data.map((r) => [r.id, { readerId: r.id, pseudonym: r.pseudonym, city: r.city, avatar: toAvatar(r) }]));
}

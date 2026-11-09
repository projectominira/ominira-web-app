import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { passageDay, PASSAGE_ZONE } from "@/lib/rooms/passage";
import { addDays, localMinutes } from "@/lib/time/zone";
import { DAY_COLUMNS, dayViews, QUOTE_COLUMNS, quoteViews, setTodayFromQuote } from "./sets";
import type { CalendarView, PassageKind } from "./types";

// The passage content calendar (passage-spec §8.3): approved quotes hold a
// day each, today plus 29 are shown, and the 5-minute cron publishes the
// day's quote from 07:00 Lagos.

const db = () => getSupabaseAdminClient();

/** How far ahead the calendar shows and plans. */
export const CALENDAR_DAYS = 30;
/** When a scheduled passage goes out, in minutes after midnight Lagos. */
const PUBLISH_AT = 7 * 60;
/** The most quotes Fill offers. */
const WAITING_LIMIT = 100;

const today = () => passageDay(Date.now());

/** Today plus 29: today's posted passage or the quote approved for each
 * day, and the quotes waiting for review. */
export async function getCalendar(): Promise<CalendarView> {
  const first = today();
  const last = addDays(first, CALENDAR_DAYS - 1);
  const [posted, approved, waiting] = await Promise.all([
    db().from("daily_passages").select(DAY_COLUMNS).eq("day", first).maybeSingle(),
    db().from("passage_quotes").select(QUOTE_COLUMNS).eq("status", "approved").gte("day", first).lte("day", last),
    db().from("passage_quotes").select(QUOTE_COLUMNS).eq("status", "new").order("created_at", { ascending: false }).limit(WAITING_LIMIT),
  ]);
  if (posted.error) throw posted.error;
  if (approved.error) throw approved.error;
  if (waiting.error) throw waiting.error;
  const [views, todays] = await Promise.all([quoteViews([...approved.data, ...waiting.data]), dayViews(posted.data ? [posted.data] : [])]);
  const byDay = new Map(approved.data.map((q) => [q.day, views.get(q.id) ?? null]));
  return {
    today: first,
    days: Array.from({ length: CALENDAR_DAYS }, (_, i) => {
      const day = addDays(first, i);
      return { day, posted: i === 0 ? (todays[0] ?? null) : null, quote: byDay.get(day) ?? null };
    }),
    waiting: waiting.data.flatMap((q) => views.get(q.id) ?? []),
  };
}

/** The days from `from` (to `to`, or on) that hold an approved quote, with
 * its kind. */
async function heldDays(from: string, to?: string) {
  let query = db().from("passage_quotes").select("id, day, kind").eq("status", "approved").gte("day", from);
  if (to) query = query.lte("day", to);
  const { data, error } = await query;
  if (error) throw error;
  return new Map(data.map((q) => [q.day as string, { id: q.id, kind: q.kind as PassageKind }]));
}

/** Today counts as a day to plan while it has no passage yet. */
async function firstOpenDay(): Promise<string> {
  const day = today();
  const { data, error } = await db().from("daily_passages").select("day").eq("day", day).maybeSingle();
  if (error) throw error;
  return data ? addDays(day, 1) : day;
}

const nextFree = (held: Map<string, unknown>, from: string) => {
  let day = from;
  while (held.has(day)) day = addDays(day, 1);
  return day;
};

export type ScheduleOutcome = { day: string; bumped: { id: string; day: string } | null } | "not_found" | "past" | "taken";

/**
 * Approves a quote for a day (§8.3): the day picked, an anniversary's own
 * date, else the first free day from tomorrow. An anniversary or topical
 * quote moves an evergreen one off its day; it can't take another's.
 */
export async function approveQuote(id: string, picked?: string): Promise<ScheduleOutcome> {
  const { data: q, error } = await db().from("passage_quotes").select("id, kind, wanted_day, status").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!q || (q.status !== "new" && q.status !== "approved")) return "not_found";
  const open = await firstOpenDay();
  const tomorrow = addDays(today(), 1);
  const day = picked ?? (q.kind === "anniversary" && q.wanted_day ? q.wanted_day : null);
  if (day && day < open) return "past";

  const held = await heldDays(open);
  for (const [d, h] of held) if (h.id === id) held.delete(d);
  let bumped: { id: string; day: string } | null = null;
  let target: string;
  if (!day) target = nextFree(held, tomorrow);
  else {
    const holder = held.get(day);
    if (holder) {
      // A day picked by hand is never taken from another quote.
      if (picked || holder.kind !== "evergreen") return "taken";
      held.set(day, { id, kind: q.kind });
      bumped = { id: holder.id, day: nextFree(held, tomorrow) };
      const { error: moveError } = await db().from("passage_quotes").update({ day: bumped.day }).eq("id", holder.id);
      if (moveError) throw moveError;
    }
    target = day;
  }
  const { error: saveError } = await db().from("passage_quotes").update({ status: "approved", day: target }).eq("id", id);
  if (saveError) throw saveError;
  return { day: target, bumped };
}

/** Moves an approved quote to another day; a day already held swaps the
 * two quotes. */
export async function moveQuote(id: string, day: string): Promise<{ day: string; swapped: string | null } | "not_found" | "past"> {
  const { data: q, error } = await db().from("passage_quotes").select("id, day, status").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!q || q.status !== "approved" || !q.day) return "not_found";
  if (day < (await firstOpenDay()) || day > addDays(today(), CALENDAR_DAYS - 1)) return "past";
  if (day === q.day) return { day, swapped: null };
  const { data: other, error: otherError } = await db().from("passage_quotes").select("id").eq("status", "approved").eq("day", day).maybeSingle();
  if (otherError) throw otherError;
  // One day per approved quote (passage_quotes_day_idx): clear this one's
  // day first, so the other can take it.
  const set = async (quoteId: string, to: string | null) => {
    const { error: e } = await db().from("passage_quotes").update({ day: to }).eq("id", quoteId);
    if (e) throw e;
  };
  if (other) {
    await set(id, null);
    await set(other.id, q.day);
  }
  await set(id, day);
  return { day, swapped: other?.id ?? null };
}

/** How many days in a row from tomorrow have a passage planned. */
export async function daysPlanned(): Promise<{ count: number; through: string | null }> {
  const tomorrow = addDays(today(), 1);
  const held = await heldDays(tomorrow, addDays(tomorrow, CALENDAR_DAYS - 1));
  let count = 0;
  while (held.has(addDays(tomorrow, count))) count++;
  return { count, through: count ? addDays(tomorrow, count - 1) : null };
}

/**
 * From the 5-minute cron (§8.3): from 07:00 Lagos, posts and pushes the
 * quote approved for today unless today already has a passage. Quotes left
 * on a day that's gone, or on today when it was set by hand, go back to
 * review. Running again does nothing.
 */
export async function publishScheduledPassage(): Promise<"published" | "none" | "early" | string> {
  const now = Date.now();
  const day = passageDay(now);
  const { error: staleError } = await db().from("passage_quotes").update({ status: "new", day: null }).eq("status", "approved").lt("day", day);
  if (staleError) throw staleError;
  if (localMinutes(now, PASSAGE_ZONE) < PUBLISH_AT) return "early";

  const [posted, due] = await Promise.all([
    db().from("daily_passages").select("day").eq("day", day).maybeSingle(),
    db().from("passage_quotes").select("id").eq("status", "approved").eq("day", day).maybeSingle(),
  ]);
  if (posted.error) throw posted.error;
  if (due.error) throw due.error;
  if (!due.data) return "none";
  if (posted.data) {
    const { error } = await db().from("passage_quotes").update({ status: "new", day: null }).eq("id", due.data.id);
    if (error) throw error;
    return "none";
  }
  const outcome = await setTodayFromQuote(due.data.id, null);
  return typeof outcome === "string" ? outcome : "published";
}

// ---- Editorial brief (§8.5) ----------------------------------------------

export const DEFAULT_BRIEF = `Ominira passages keep a revolutionary zeal alive: Pan-African, anti-imperialist and emancipatory. Choose words that stir, sharpen or give hope, not ones that only describe despair. Keep them short and plain-spoken, no academic jargon. Each passage should make a member want to read the book.

Key dates (confirm each with a web search before using it):
- 1 Jan: Haiti declares independence (1804)
- 17 Jan: Patrice Lumumba assassinated (1961)
- 20 Jan: Amílcar Cabral assassinated (1973)
- 11 Feb: Nelson Mandela released (1990)
- 21 Feb: Malcolm X assassinated (1965)
- 6 Mar: Ghana's independence (1957)
- 21 Mar: Sharpeville massacre (1960)
- 23 Mar: Walter Rodney born (1942)
- 27 Apr: Kwame Nkrumah dies (1972)
- 19 May: Malcolm X born (1925)
- 25 May: Africa Day (OAU founded, 1963)
- 13 Jun: Walter Rodney assassinated (1980)
- 16 Jun: Soweto uprising (1976)
- 30 Jun: Congo's independence and Lumumba's speech (1960)
- 20 Jul: Frantz Fanon born (1925)
- 17 Aug: Marcus Garvey born (1887)
- 23 Aug: Day for the Remembrance of the Slave Trade and its Abolition
- 12 Sep: Steve Biko dies in detention (1977); Amílcar Cabral born (1924)
- 21 Sep: Kwame Nkrumah born (1909)
- 1 Oct: Nigeria's independence (1960)
- 15 Oct: Thomas Sankara assassinated (1987)
- 6 Dec: Frantz Fanon dies (1961)
- 21 Dec: Thomas Sankara born (1949)`;

export async function getBrief(): Promise<{ body: string; updatedAt: string | null }> {
  const { data, error } = await db().from("editorial_brief").select("body, updated_at").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data ? { body: data.body, updatedAt: data.updated_at } : { body: DEFAULT_BRIEF, updatedAt: null };
}

export async function saveBrief(body: string): Promise<string> {
  const updatedAt = new Date().toISOString();
  const { error } = await db().from("editorial_brief").upsert({ id: 1, body, updated_at: updatedAt });
  if (error) throw error;
  return updatedAt;
}

import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { getFeaturedBooks } from "@/lib/featured/config";
import { MATERIAL_SUMMARY_COLUMNS } from "@/lib/materials/columns";
import { resolveBookCoverSrc } from "@/lib/materials/image";
import { fetchMaterialManifest } from "@/lib/materials/manifest";
import { toMaterialSummary } from "@/lib/materials/summary";
import { buildResumeHref, isLocator } from "@/lib/reader/locator";
import { roomTitle } from "@/lib/room/title";
import { getStreakToday, getStreakView } from "@/lib/streaks/record";
import { homeGroups } from "@/lib/groups/home";
import { chapterEnds } from "@/lib/groups/progress";
import { enrichFeedItems } from "@/lib/community/feed";
import { communityFeedItemHref } from "@/lib/community/useCommunityFeed";
import { comradesById } from "./comrades";
import { passageDay } from "./passage";
import { buildStrip, byLatest, chapterLine, previewText, READING_NOW_MS, STRIP_MS } from "./home";
import type { CurrentBook, HomePassage, HomeView, RoomRowView, StatusItem } from "./types";

// Home (home-spec §5.2) in one call, for the thin app/api/auth/me/home
// route: the rooms live now, the book you're reading, the streak, your study
// groups, the book rooms and Featured. Every read starts as soon as what it needs is in; the rules are
// lib/rooms/home. "Start a room"'s suggestions load with its sheet
// (lib/rooms/startable), not here: Home refetches every minute.

/** Continue reading: where the reader left off and in which chapter, and
 * how — reading or listening, as the Shelf tells — with both ways back in. */
async function getCurrentBook(readerId: string): Promise<CurrentBook | null> {
  const admin = getSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("reader_activities")
    .select("material_id, progress_percent, locator, mode")
    .eq("reader_id", readerId)
    .is("finished_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const { data: material, error: materialError } = await admin
    .from("materials")
    .select(`${MATERIAL_SUMMARY_COLUMNS}, json_storage_path`)
    .eq("id", row.material_id)
    .eq("status", "published")
    .maybeSingle();
  if (materialError) throw materialError;
  if (!material) return null;

  // The outline lives in the book's manifest; only sectioned books have one,
  // and a missing one only costs the chapter line.
  const outline = material.json_storage_path ? await fetchMaterialManifest(material.json_storage_path).catch(() => null) : null;
  const pct = row.progress_percent ?? 0;
  const summary = toMaterialSummary(material);
  const locator = isLocator(row.locator) ? row.locator : null;
  const href = (mode: "read" | "listen") =>
    locator ? buildResumeHref(summary.slug, { locator, mode }) : `/read/${summary.slug}${mode === "listen" ? "?listen=1" : ""}`;
  return {
    material: summary,
    chapter: outline ? chapterLine(chapterEnds(outline.toc, outline.spine), pct) : null,
    pct: Math.round(pct),
    listening: row.mode === "listen",
    readHref: href("read"),
    listenHref: href("listen"),
  };
}

/** The status strip: the rooms live now on public books, and how many are
 * listening in each. */
async function getStrip(): Promise<StatusItem[]> {
  const admin = getSupabaseAdminClient();
  const { data: rooms, error } = await admin.from("rooms").select("id, material_id, title").eq("status", "live").is("group_id", null);
  if (error) throw error;
  if (rooms.length === 0) return [];
  const [materials, members] = await Promise.all([
    admin.from("materials").select(MATERIAL_SUMMARY_COLUMNS).in("id", rooms.map((r) => r.material_id)).eq("status", "published").eq("visibility", "public"),
    Promise.all(rooms.map((r) => activeCount(r.id))),
  ]);
  if (materials.error) throw materials.error;
  const books = new Map(materials.data.map((m) => [m.id, toMaterialSummary(m)]));
  return buildStrip(
    null,
    rooms.flatMap((r, i) => {
      const m = books.get(r.material_id);
      if (!m) return [];
      return [{ id: m.slug, kind: "book" as const, name: m.title, cover: resolveBookCoverSrc(m), materialId: m.id, room: { id: r.id, title: roomTitle(r.title, m.title) }, live: members[i], reading: 0 }];
    }),
  );
}

/** Rows shown at most: the latest. */
const BOOK_ROOMS_MAX = 20;

/** Every book room with a note you can read (book_rooms: its latest note or
 * reply and your unread), with who wrote it, live listeners and comrades
 * reading now. */
async function getBookRooms(readerId: string | null): Promise<RoomRowView[]> {
  const admin = getSupabaseAdminClient();
  const now = Date.now();
  const [rooms, readers, live] = await Promise.all([
    admin.rpc("book_rooms", { reader: readerId }),
    admin.rpc("book_readers", { day_since: new Date(now - STRIP_MS).toISOString(), now_since: new Date(now - READING_NOW_MS).toISOString(), reader: readerId }),
    admin.from("rooms").select("id, material_id").eq("status", "live").is("group_id", null),
  ]);
  if (rooms.error) throw rooms.error;
  if (readers.error) throw readers.error;
  if (live.error) throw live.error;
  const latest = byLatest(rooms.data.map((r) => ({ ...r, last: { at: r.created_at } }))).slice(0, BOOK_ROOMS_MAX);
  if (latest.length === 0) return [];
  const ids = latest.map((r) => r.material_id);
  const liveHere = live.data.filter((r) => ids.includes(r.material_id));
  const [materials, names, listening] = await Promise.all([
    admin.from("materials").select(MATERIAL_SUMMARY_COLUMNS).in("id", ids).eq("status", "published"),
    comradesById(latest.map((r) => r.author)),
    Promise.all(liveHere.map(async (r) => [r.material_id, await activeCount(r.id)] as const)),
  ]);
  if (materials.error) throw materials.error;
  const books = new Map(materials.data.map((m) => [m.id, toMaterialSummary(m)]));
  const readingNow = new Map(readers.data.map((r) => [r.material_id, r.now]));
  const listeners = new Map(listening);
  return latest.flatMap((r) => {
    const m = books.get(r.material_id);
    const who = names.get(r.author);
    if (!m) return [];
    return [
      {
        slug: m.slug,
        name: m.title,
        cover: resolveBookCoverSrc(m),
        last: { who: who?.pseudonym ?? "", avatar: who?.avatar ?? { color: null, url: null }, mine: r.author === readerId, reply: r.reply, text: previewText(r), at: r.created_at },
        unread: r.unread,
        live: listeners.get(m.id) ?? null,
        readingNow: readingNow.get(m.id) ?? 0,
      },
    ];
  });
}

async function activeCount(roomId: string): Promise<number> {
  const { data, error } = await getSupabaseAdminClient().rpc("room_active_count", { room: roomId });
  if (error) throw error;
  return data;
}

/** Today's passage of the day (rooms-spec §5.5): its question and quote, and
 * how many have answered. Null when none is set today. */
async function getPassage(): Promise<HomePassage | null> {
  const { data: day, error } = await getSupabaseAdminClient().from("daily_passages").select("post_id, question").eq("day", passageDay(Date.now())).maybeSingle();
  if (error) throw error;
  return day && passageView(day);
}

/** A day's passage as Home shows it (/admin/passage's Today shows the same). */
export async function passageView(day: { post_id: string; question: string }): Promise<HomePassage | null> {
  const { data: post, error: postError } = await getSupabaseAdminClient().from("posts").select("*").eq("id", day.post_id).eq("visibility", "public").maybeSingle();
  if (postError) throw postError;
  if (!post) return null;
  const [item] = await enrichFeedItems([post], null);
  const href = item && communityFeedItemHref(item);
  if (!item?.excerpt || !item.material || !href) return null;
  const cite = [item.material.title, item.label].filter(Boolean).join(" · ");
  return { question: day.question, excerpt: item.excerpt, cite, answers: item.replies.length, href };
}

/** Signed out (`readerId` null), Home is the public hub: the rooms live now,
 * groups to join, the book rooms' public notes and Featured; no streak and
 * no reading of your own. */
export async function getHomeView(readerId: string | null): Promise<HomeView> {
  const streakP = readerId ? getStreakView(readerId) : null;
  const [strip, streak, today, current, groups, rooms, featured, passage] = await Promise.all([
    getStrip(),
    streakP,
    streakP?.then((v) => getStreakToday(readerId!, v.today)) ?? null,
    readerId ? getCurrentBook(readerId) : null,
    homeGroups(readerId),
    getBookRooms(readerId),
    getFeaturedBooks(),
    getPassage(),
  ]);
  return { strip, current, streak, today, groups, rooms, featured: featured.map((f) => ({ material: f.material, sub: f.material.author ?? "" })), passage };
}

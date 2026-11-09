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
import { communityFeedItemHref } from "@/lib/community/feedHref";
import { comradesById } from "./comrades";
import { passageDay } from "./passage";
import { buildStrip, byLatest, chapterLine, previewText, READING_NOW_MS, STRIP_MS } from "./home";
import { BOOK_ROOMS } from "@/lib/config/features";
import { forYouBooks } from "@/lib/recommend/books";
import { withCurrentReaders } from "@/lib/materials/list";
import { passageContext } from "@/lib/passage/types";
import type { CurrentBook, HomePassage, HomeView, RoomRowView, StatusItem } from "./types";

// Home (home-spec §5.2) in one call, for the thin app/api/auth/me/home
// route, signed in only: the rooms live now, the books you're reading, the
// streak, your study groups and groups to join, For you, the book rooms
// (while shown) and the passage. Every read starts as soon as what it needs
// is in; the rules are lib/rooms/home.

/** Recent books checked for the current one (an unpublished one is
 * skipped). */
const READING_MAX = 3;

/** Continue reading: where the reader left off and in which chapter, and
 * how — reading or listening, as the Shelf tells — with both ways back in. */
async function getReading(readerId: string): Promise<{ current: CurrentBook | null }> {
  const admin = getSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("reader_activities")
    .select("material_id, progress_percent, locator, mode")
    .eq("reader_id", readerId)
    .is("finished_at", null)
    .order("updated_at", { ascending: false })
    .limit(READING_MAX);
  if (error) throw error;
  if (rows.length === 0) return { current: null };

  const { data: materials, error: materialError } = await admin
    .from("materials")
    .select(`${MATERIAL_SUMMARY_COLUMNS}, json_storage_path`)
    .in("id", rows.map((r) => r.material_id))
    .eq("status", "published");
  if (materialError) throw materialError;
  const byId = new Map(materials.map((m) => [m.id, m]));
  const books = rows.flatMap((row) => {
    const material = byId.get(row.material_id);
    if (!material) return [];
    const summary = toMaterialSummary(material);
    const locator = isLocator(row.locator) ? row.locator : null;
    const href = (mode: "read" | "listen") =>
      locator ? buildResumeHref(summary.slug, { locator, mode }) : `/read/${summary.slug}${mode === "listen" ? "?listen=1" : ""}`;
    return [{ row, material, summary, href }];
  });
  const [first] = books;
  if (!first) return { current: null };

  // The outline lives in the book's manifest; only sectioned books have one,
  // and a missing one only costs the chapter line.
  const { row, material, summary, href } = first;
  const outline = material.json_storage_path ? await fetchMaterialManifest(material.json_storage_path).catch(() => null) : null;
  const pct = row.progress_percent ?? 0;
  return {
    current: {
      material: summary,
      chapter: outline ? chapterLine(chapterEnds(outline.toc, outline.spine), pct) : null,
      pct: Math.round(pct),
      listening: row.mode === "listen",
      readHref: href("read"),
      listenHref: href("listen"),
    },
  };
}

/** The status strip: the rooms live now on public books, and how many are
 * listening in each. */
export async function getStrip(): Promise<StatusItem[]> {
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
        last: { who: who?.pseudonym ?? "", avatar: who?.avatar ?? { color: null, url: null }, mine: r.author === readerId, kind: r.reply ? "reply" : "note", text: previewText(r), at: r.created_at },
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

/** Today's passage of the day (rooms-spec §5.5): the quote and its line of
 * context. Null when none is set today. */
async function getPassage(): Promise<HomePassage | null> {
  const today = passageDay(Date.now());
  const { data: day, error } = await getSupabaseAdminClient().from("daily_passages").select("post_id").eq("day", today).maybeSingle();
  if (error) throw error;
  return day && passageView(day.post_id, today);
}

/** A day's passage as Home shows it. `day` is YYYY-MM-DD. */
export async function passageView(postId: string, day: string): Promise<HomePassage | null> {
  const admin = getSupabaseAdminClient();
  const [{ data: post, error: postError }, { data: quote, error: quoteError }] = await Promise.all([
    admin.from("posts").select("*").eq("id", postId).eq("visibility", "public").maybeSingle(),
    admin.from("passage_quotes").select("kind, occasion").eq("post_id", postId).limit(1).maybeSingle(),
  ]);
  if (postError) throw postError;
  if (quoteError) throw quoteError;
  if (!post) return null;
  const [item] = await enrichFeedItems([post], null);
  const href = item && communityFeedItemHref(item);
  if (!item?.excerpt || !item.material || !href) return null;
  const m = item.material;
  return {
    excerpt: item.excerpt,
    day: new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }),
    context: quote ? passageContext(quote.kind, quote.occasion) : null,
    href,
    book: { title: m.title, author: m.author, cover: resolveBookCoverSrc(m), materialType: m.materialType },
    where: item.label,
  };
}

/** Home for a signed-in reader: the rooms live now, your reading and
 * streak, "Start here" (the first Featured, while you've no book of your
 * own), For you, your groups and groups to join, and the passage of the
 * day. */
export async function getHomeView(readerId: string): Promise<HomeView> {
  const streakP = getStreakView(readerId);
  const readingP = getReading(readerId);
  const startP = readingP.then((r) => (r.current ? null : getFeaturedBooks().then((f) => f[0]?.material ?? null)));
  const forYouP = forYouBooks(readerId, startP.then((s) => s?.id ?? null));
  const [strip, streak, today, reading, start, groups, rooms, forYou, passage] = await Promise.all([
    getStrip(),
    streakP,
    streakP.then((v) => getStreakToday(readerId, v.today)),
    readingP,
    startP,
    homeGroups(readerId, forYouP.then((f) => f.scores)),
    BOOK_ROOMS ? getBookRooms(readerId) : [],
    // Who's reading each, for the shelf's "N reading now".
    forYouP.then(async (f) => (await withCurrentReaders({ items: f.books, nextCursor: null })).items),
    getPassage(),
  ]);
  return { strip, ...reading, streak, today, groups, rooms, start, forYou, passage };
}

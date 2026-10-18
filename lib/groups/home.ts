import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { chapterLabel } from "@/lib/groups/copy";
import { chapterEnds, groupMean } from "@/lib/groups/progress";
import { SESSION_LENGTH } from "@/lib/groups/sessions";
import { MATERIAL_SUMMARY_COLUMNS } from "@/lib/materials/columns";
import { resolveBookCoverSrc } from "@/lib/materials/image";
import { fetchMaterialManifest } from "@/lib/materials/manifest";
import { toMaterialSummary } from "@/lib/materials/summary";
import { visiblePostsFilter } from "@/lib/community/visibility";
import { loadPostViewer } from "@/lib/community/viewer";
import { comradesById } from "@/lib/rooms/comrades";
import { previewText } from "@/lib/rooms/home";
import { groupPostScope } from "@/lib/rooms/stream";
import type { GroupCardView, RoomLast } from "@/lib/rooms/types";

// Home's study groups (lib/rooms/homeView): a card per group, every read
// batched across the groups so a reader in several still costs three rounds.

/** Cards at most: your groups, latest joined first. */
const MAX_CARDS = 10;
/** While you're in fewer groups than this, Home offers some to join. */
const FEW = 2;
/** Groups offered to join, the biggest first. */
const OPEN_CARDS = 6;

const ok = <T>(r: { data: T | null; error: unknown }): T => {
  if (r.error) throw r.error;
  return r.data as T;
};

export async function homeGroups(readerId: string | null): Promise<GroupCardView[]> {
  const admin = getSupabaseAdminClient();
  // Who may read which notes, for the groups' previews; read alongside.
  const viewerP = loadPostViewer(readerId);
  const mine = readerId
    ? ok(await admin.from("group_members").select("group_id").eq("reader_id", readerId).order("joined_at", { ascending: false }).limit(MAX_CARDS)).map((m) => m.group_id)
    : [];
  // Newest first, so a group just started has a chance to be found; sorted
  // by size once its members are counted.
  const open =
    mine.length < FEW
      ? ok(
          await (mine.length ? admin.from("groups").select("id").not("id", "in", `(${mine.join(",")})`) : admin.from("groups").select("id"))
            .order("created_at", { ascending: false })
            .limit(OPEN_CARDS * 2)
        ).map((g) => g.id)
      : [];
  const ids = [...mine, ...open];
  if (ids.length === 0) return [];

  const over = new Date(Date.now() - SESSION_LENGTH).toISOString();
  const [groups, members, books, sessions, live, reads] = await Promise.all([
    admin.from("groups").select("id, slug, name").in("id", ids).then(ok),
    admin.from("group_members").select("group_id, reader_id").in("group_id", ids).then(ok),
    admin.from("group_books").select("group_id, material_id, status").in("group_id", ids).then(ok),
    admin.from("group_sessions").select("group_id, starts_at").in("group_id", ids).is("cancelled_at", null).gt("starts_at", over).order("starts_at").then(ok),
    admin.from("rooms").select("id, group_id").in("group_id", ids).eq("status", "live").then(ok),
    readerId && mine.length
      ? admin.from("room_reads").select("room_id, last_read_at").eq("reader_id", readerId).eq("room_kind", "group").in("room_id", mine).then(ok)
      : [],
  ]);

  const membersOf = groupBy(members, (m) => m.group_id, (m) => m.reader_id);
  const booksOf = groupBy(books, (b) => b.group_id, (b) => b.material_id);
  const currentOf = new Map(books.filter((b) => b.status === "current").map((b) => [b.group_id, b.material_id]));
  const nextOf = new Map<string, string>();
  for (const s of sessions) if (!nextOf.has(s.group_id)) nextOf.set(s.group_id, s.starts_at);
  const lastRead = new Map(reads.map((r) => [r.room_id, r.last_read_at]));
  const currentIds = [...new Set(currentOf.values())];
  const readerIds = [...new Set(members.map((m) => m.reader_id))];

  const visible = visiblePostsFilter(await viewerP);
  const [materials, progress, listening, unread, latest] = await Promise.all([
    currentIds.length ? admin.from("materials").select(`${MATERIAL_SUMMARY_COLUMNS}, json_storage_path`).in("id", currentIds).then(ok) : [],
    currentIds.length && readerIds.length
      ? admin.from("reader_activities").select("reader_id, material_id, progress_percent").in("material_id", currentIds).in("reader_id", readerIds).then(ok)
      : [],
    Promise.all(live.map(async (r) => [r.group_id, ok(await admin.rpc("room_active_count", { room: r.id }))] as const)).then((pairs) => new Map(pairs)),
    // Comrades' notes in each of your groups since you last read it; a group
    // you've never opened shows none.
    Promise.all(
      mine.map(async (id) => {
        const since = lastRead.get(id);
        if (!since || !readerId) return [id, 0] as const;
        const { count, error } = await admin
          .from("posts")
          .select("id", { count: "exact", head: true })
          .is("parent_id", null)
          .or(groupPostScope(id, membersOf.get(id) ?? [], booksOf.get(id) ?? []))
          .neq("reader_id", readerId)
          .gt("created_at", since);
        if (error) throw error;
        return [id, count ?? 0] as const;
      })
    ).then((pairs) => new Map(pairs)),
    // Each of your groups' latest note you can read, for its row's preview.
    Promise.all(
      mine.map(async (id) => {
        const { data, error } = await admin
          .from("posts")
          .select("reader_id, kind, content, created_at")
          .is("parent_id", null)
          .or(visible)
          .or(groupPostScope(id, membersOf.get(id) ?? [], booksOf.get(id) ?? []))
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return [id, data] as const;
      })
    ).then((pairs) => new Map(pairs)),
  ]);

  // Where each current book's chapters end; a missing manifest only costs
  // the chapter. The previews' authors load alongside.
  const [ends, authors] = await Promise.all([
    Promise.all(
      materials.map(async (m) => {
        const outline = m.json_storage_path ? await fetchMaterialManifest(m.json_storage_path).catch(() => null) : null;
        return [m.id, outline ? chapterEnds(outline.toc, outline.spine) : []] as const;
      })
    ).then((pairs) => new Map(pairs)),
    comradesById([...latest.values()].flatMap((p) => (p ? [p.reader_id] : []))),
  ]);
  const lastOf = (id: string): RoomLast | null => {
    const p = latest.get(id);
    if (!p) return null;
    const who = authors.get(p.reader_id);
    return { who: who?.pseudonym ?? "", avatar: who?.avatar ?? { color: null, url: null }, mine: p.reader_id === readerId, text: previewText(p), at: p.created_at };
  };
  const summaries = new Map(materials.map((m) => [m.id, toMaterialSummary(m)]));
  const pctOf = (groupId: string, materialId: string) => {
    const inGroup = new Set(membersOf.get(groupId));
    return groupMean(progress.filter((p) => p.material_id === materialId && inGroup.has(p.reader_id)).map((p) => p.progress_percent));
  };

  const byId = new Map(groups.map((g) => [g.id, g]));
  const card = (id: string, joined: boolean): GroupCardView[] => {
    const g = byId.get(id);
    if (!g) return [];
    const materialId = currentOf.get(id);
    const book = materialId ? summaries.get(materialId) : undefined;
    const pct = book ? pctOf(id, book.id) : null;
    const end = pct === null ? undefined : ends.get(book!.id)?.find((e) => e.endPct > pct);
    return [
      {
        slug: g.slug,
        name: g.name,
        members: membersOf.get(id)?.length ?? 0,
        joined,
        book: book ? { title: book.title, cover: resolveBookCoverSrc(book), pct: pct === null ? null : Math.round(pct), chapter: end ? chapterLabel(end.label) : null } : null,
        nextAt: nextOf.get(id) ?? null,
        unread: unread.get(id) ?? 0,
        live: listening.get(id) ?? null,
        last: lastOf(id),
      },
    ];
  };
  return [
    ...mine.flatMap((id) => card(id, true)),
    ...open
      .flatMap((id) => card(id, false))
      .sort((a, b) => b.members - a.members)
      .slice(0, OPEN_CARDS),
  ];
}

function groupBy<T, V>(rows: T[], key: (r: T) => string, value: (r: T) => V): Map<string, V[]> {
  const out = new Map<string, V[]>();
  for (const r of rows) {
    const k = key(r);
    const list = out.get(k);
    if (list) list.push(value(r));
    else out.set(k, [value(r)]);
  }
  return out;
}

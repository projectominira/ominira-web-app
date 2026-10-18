import "server-only";

import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { notifyReaders, type NotifyTally } from "@/lib/notifications/notify";
import { groupHref } from "@/lib/groups/copy";
import { findGroupById, isModerator, roleOf, type Group, type GroupOutcome } from "@/lib/groups/membership";
import { groupLiveRoom } from "@/lib/groups/rooms";
import { currentBook } from "@/lib/groups/targets";
import { nextOccurrence, reminderDue, reminderKey, SESSION_LENGTH, sessionPhase, SOON, startsIn, wallTime } from "@/lib/groups/sessions";
import { SESSION_TOPIC_MAX, type GroupSession, type SessionPeople, type SessionsView } from "@/lib/groups/types";
import { comradesById } from "@/lib/rooms/comrades";
import type { NextSession } from "@/lib/room/types";
import type { Database } from "@/lib/supabase/database.types";

// Sessions (studygroup-spec.md §3.2 M8, §9.3) for the thin
// app/api/groups/{slug}/sessions routes and the cron reminder. Numbering and
// one row per occurrence are SQL's (add_group_session,
// migrations/20261026_group_sessions.sql); when the next weekly occurrence
// is due is lib/groups/sessions.ts.

type SessionRow = Database["public"]["Tables"]["group_sessions"]["Row"];

/** Rows shown on each side of now. */
const LIST_LIMIT = 10;

function toSession(row: SessionRow, optedOut: Set<string> | null, attended: Set<string> | null = null): GroupSession {
  const session = {
    id: row.id,
    seriesId: row.series_id,
    topic: row.topic,
    materialId: row.material_id,
    sectionLabel: row.section_label,
    startsAt: row.starts_at,
    repeat: row.repeat,
  };
  return {
    ...session,
    remind: optedOut ? !optedOut.has(reminderKey(session)) : null,
    attended: attended ? attended.has(row.id) : null,
  };
}

/**
 * Keeps each running weekly series' next occurrence materialised: once the
 * latest is over or skipped, adds the next one, a week on in the group's
 * timezone. Called on every read and by the cron; a race loses quietly
 * (add_group_session's unique occurrence).
 */
async function materialise(groupId: string | null, now: number): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { data: latest, error } = await admin.rpc("group_session_series", { grp: groupId });
  if (error) throw error;
  // Only series whose latest is over or skipped (the zone can't change that).
  const due = latest.filter((row) => !!row.cancelled_at || sessionPhase(Date.parse(row.starts_at), now) === "past");
  if (due.length === 0) return;

  const { data: groups, error: groupsError } = await admin
    .from("groups")
    .select("id, timezone")
    .in("id", [...new Set(due.map((r) => r.group_id))]);
  if (groupsError) throw groupsError;
  const zoneOf = new Map(groups.map((g) => [g.id, g.timezone]));

  await Promise.all(
    due.map(async (row) => {
      const tz = zoneOf.get(row.group_id);
      const next = tz && nextOccurrence({ startsAt: Date.parse(row.starts_at), cancelled: !!row.cancelled_at }, tz, now);
      if (!next) return;
      const { error: addError } = await admin.rpc("add_group_session", {
        grp: row.group_id,
        series: row.series_id,
        new_topic: row.topic,
        material: row.material_id,
        new_section_label: row.section_label,
        new_starts_at: new Date(next).toISOString(),
        new_repeat: "weekly",
        reader: row.created_by,
      });
      if (addError) throw addError;
    })
  );
}

async function optOuts(readerId: string, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const { data, error } = await getSupabaseAdminClient()
    .from("session_reminder_optouts")
    .select("series_or_session_id")
    .eq("reader_id", readerId)
    .in("series_or_session_id", keys);
  if (error) throw error;
  return new Set(data.map((r) => r.series_or_session_id));
}

/** `detail: false` skips what only the room shows (the next session's
 * people, past runs): Home reads the view for its group row. */
export async function getSessionsView(group: Group, viewerId: string | null, { detail = true } = {}): Promise<SessionsView> {
  const now = Date.now();
  await materialise(group.id, now);
  const admin = getSupabaseAdminClient();
  const over = new Date(now - SESSION_LENGTH).toISOString();
  const open = () => admin.from("group_sessions").select("*").eq("group_id", group.id).is("cancelled_at", null);
  const [upcoming, past, held, role, live] = await Promise.all([
    open().gt("starts_at", over).order("starts_at").limit(LIST_LIMIT),
    open().lte("starts_at", over).order("starts_at", { ascending: false }).limit(LIST_LIMIT),
    admin.from("group_sessions").select("id").eq("group_id", group.id).is("cancelled_at", null).lte("starts_at", new Date(now).toISOString()),
    viewerId ? roleOf(group.id, viewerId) : null,
    groupLiveRoom(group.id),
  ]);
  if (upcoming.error) throw upcoming.error;
  if (past.error) throw past.error;
  if (held.error) throw held.error;

  const member = role && viewerId ? viewerId : null;
  const [[optedOut, attended], next, runs] = await Promise.all([
    member
      ? Promise.all([
          optOuts(member, [...new Set(upcoming.data.map((r) => r.series_id ?? r.id))]),
          attendance(
            member,
            held.data.map((r) => r.id)
          ),
        ])
      : [null, null],
    detail && upcoming.data[0] ? sessionPeople(group.id, upcoming.data[0]) : null,
    detail ? pastRuns(past.data.map((r) => r.id)) : {},
  ]);
  return {
    timezone: group.timezone,
    upcoming: upcoming.data.map((r) => toSession(r, optedOut)),
    next,
    past: past.data.map((r) => toSession(r, null, attended)),
    runs,
    held: held.data.length,
    attendedCount: attended?.size ?? null,
    live,
  };
}

/** Faces on a card. */
const CARD_PEOPLE = 4;

/** The session card's host and who's going: every member who hasn't turned
 * its reminder off, in the order they joined. */
async function sessionPeople(groupId: string, row: SessionRow): Promise<SessionPeople> {
  const admin = getSupabaseAdminClient();
  const [members, off] = await Promise.all([
    admin.from("group_members").select("reader_id").eq("group_id", groupId).order("joined_at"),
    admin.from("session_reminder_optouts").select("reader_id").eq("series_or_session_id", row.series_id ?? row.id),
  ]);
  if (members.error) throw members.error;
  if (off.error) throw off.error;
  const out = new Set(off.data.map((r) => r.reader_id));
  const going = members.data.map((m) => m.reader_id).filter((id) => !out.has(id));
  const faces = going.slice(0, CARD_PEOPLE);
  const comrades = await comradesById(row.created_by ? [row.created_by, ...faces] : faces);
  return {
    host: (row.created_by && comrades.get(row.created_by)) || null,
    going: going.length,
    people: faces.flatMap((id) => comrades.get(id) ?? []),
  };
}

/** The reading rooms past sessions had: minutes run and everyone who came
 * (room_members keeps leavers). */
async function pastRuns(sessionIds: string[]): Promise<SessionsView["runs"]> {
  if (sessionIds.length === 0) return {};
  const admin = getSupabaseAdminClient();
  const { data: rooms, error } = await admin
    .from("rooms")
    .select("id, session_id, started_at, ended_at")
    .in("session_id", sessionIds)
    .not("ended_at", "is", null);
  if (error) throw error;
  if (rooms.length === 0) return {};
  const { data: came, error: cameError } = await admin.from("room_members").select("room_id").in("room_id", rooms.map((r) => r.id));
  if (cameError) throw cameError;
  const runs: SessionsView["runs"] = {};
  for (const r of rooms) {
    runs[r.session_id!] = {
      minutes: Math.max(1, Math.round((Date.parse(r.ended_at!) - Date.parse(r.started_at)) / 60_000)),
      joined: came.filter((m) => m.room_id === r.id).length,
    };
  }
  return runs;
}

/** Which of these sessions the reader came to. */
async function attendance(readerId: string, sessionIds: string[]): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();
  const { data, error } = await getSupabaseAdminClient()
    .from("session_attendance")
    .select("session_id")
    .eq("reader_id", readerId)
    .in("session_id", sessionIds);
  if (error) throw error;
  return new Set(data.map((r) => r.session_id));
}

/** M8's fields, validated by the routes. */
export const SessionInput = z.object({
  topic: z.string().trim().min(1).max(SESSION_TOPIC_MAX),
  startsAt: z.iso.datetime({ offset: true }).transform((t) => new Date(t).toISOString()),
  repeat: z.enum(["once", "weekly"]),
});
export type SessionInput = z.infer<typeof SessionInput>;

/** Schedules a session (M8) on the current book. Moderators only. */
export async function createSession(group: Group, actorId: string, input: SessionInput): Promise<GroupOutcome> {
  if (!(await isModerator(group.id, actorId))) return "forbidden";
  if (Date.parse(input.startsAt) <= Date.now()) return "starts_in_past";
  const { error } = await getSupabaseAdminClient().rpc("add_group_session", {
    grp: group.id,
    series: null,
    new_topic: input.topic,
    material: await currentBook(group.id),
    new_section_label: null,
    new_starts_at: input.startsAt,
    new_repeat: input.repeat,
    reader: actorId,
  });
  if (error) throw error;
  return "ok";
}

/** A session of this group that's still to come or on. */
async function openSession(group: Group, sessionId: string): Promise<SessionRow | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from("group_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("group_id", group.id)
    .is("cancelled_at", null)
    .gt("starts_at", new Date(Date.now() - SESSION_LENGTH).toISOString())
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Edits a session (M8). On a weekly occurrence it edits the series from
 * here on, since later ones are made from the latest. Once → weekly starts a
 * series; weekly → once ends it after this one. Moderators only.
 */
export async function updateSession(group: Group, actorId: string, sessionId: string, input: SessionInput): Promise<GroupOutcome> {
  if (!(await isModerator(group.id, actorId))) return "forbidden";
  const row = await openSession(group, sessionId);
  if (!row) return "session_not_found";
  if (input.startsAt !== row.starts_at && Date.parse(input.startsAt) <= Date.now()) return "starts_in_past";
  const { error } = await getSupabaseAdminClient()
    .from("group_sessions")
    .update({
      topic: input.topic,
      starts_at: input.startsAt,
      repeat: input.repeat,
      series_id: input.repeat === "weekly" ? (row.series_id ?? row.id) : row.series_id,
    })
    .eq("id", row.id);
  if (error) throw error;
  return "ok";
}

/** Cancels a session: `occurrence` skips it (a weekly series goes on from
 * the week after), `series` ends the weekly series here. Moderators only. */
export async function cancelSession(
  group: Group,
  actorId: string,
  sessionId: string,
  scope: "occurrence" | "series"
): Promise<GroupOutcome> {
  if (!(await isModerator(group.id, actorId))) return "forbidden";
  const row = await openSession(group, sessionId);
  if (!row) return "session_not_found";
  const { error } = await getSupabaseAdminClient()
    .from("group_sessions")
    .update({ cancelled_at: new Date().toISOString(), ...(scope === "series" && { repeat: "once" as const }) })
    .eq("id", row.id);
  if (error) throw error;
  return "ok";
}

/** Remind me (on by default), for the series or the single session. Members only. */
export async function setReminder(group: Group, readerId: string, sessionId: string, on: boolean): Promise<GroupOutcome> {
  if (!(await roleOf(group.id, readerId))) return "not_member";
  const row = await openSession(group, sessionId);
  if (!row) return "session_not_found";
  const key = row.series_id ?? row.id;
  const optouts = getSupabaseAdminClient().from("session_reminder_optouts");
  const { error } = on
    ? await optouts.delete().eq("series_or_session_id", key).eq("reader_id", readerId)
    : await optouts.upsert({ series_or_session_id: key, reader_id: readerId }, { ignoreDuplicates: true });
  if (error) throw error;
  return "ok";
}

/** Each held book's session count, for the reading list's Done rows. */
export async function sessionsPerBook(groupId: string): Promise<Map<string, number>> {
  const { data, error } = await getSupabaseAdminClient()
    .from("group_sessions")
    .select("material_id")
    .eq("group_id", groupId)
    .is("cancelled_at", null)
    .not("material_id", "is", null)
    .lte("starts_at", new Date().toISOString());
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const { material_id } of data) counts.set(material_id!, (counts.get(material_id!) ?? 0) + 1);
  return counts;
}

/**
 * `session_soon` (§7): an hour before each session, to every member who
 * kept Remind me on, with the time in their own zone ("Session in an hour ·
 * The pitfalls of national consciousness, 19:00"). One per session and
 * reader. Materialises the weekly series first, so a series always has its
 * next occurrence to remind about.
 */
export async function sendSessionReminders(now = Date.now()): Promise<NotifyTally> {
  const tally: NotifyTally = { readers: 0, pushed: 0, emailed: 0 };
  await materialise(null, now);
  const admin = getSupabaseAdminClient();
  const { data: sessions, error } = await admin
    .from("group_sessions")
    .select("*")
    .is("cancelled_at", null)
    .gt("starts_at", new Date(now).toISOString())
    .lte("starts_at", new Date(now + SOON).toISOString());
  if (error) throw error;
  const due = sessions.filter((s) => reminderDue(Date.parse(s.starts_at), now));
  if (due.length === 0) return tally;

  const groupIds = [...new Set(due.map((s) => s.group_id))];
  const [groups, members, optouts] = await Promise.all([
    admin.from("groups").select("id, slug, name, timezone").in("id", groupIds),
    admin.from("group_members").select("group_id, reader_id").in("group_id", groupIds),
    admin
      .from("session_reminder_optouts")
      .select("series_or_session_id, reader_id")
      .in("series_or_session_id", [...new Set(due.map((s) => s.series_id ?? s.id))]),
  ]);
  if (groups.error) throw groups.error;
  if (members.error) throw members.error;
  if (optouts.error) throw optouts.error;

  const readerIds = [...new Set(members.data.map((m) => m.reader_id))];
  const { data: readers, error: readersError } = await admin.from("readers").select("id, timezone").in("id", readerIds);
  if (readersError) throw readersError;
  const zoneOf = new Map(readers.map((r) => [r.id, r.timezone]));

  for (const session of due) {
    const group = groups.data.find((g) => g.id === session.group_id);
    if (!group) continue;
    const key = session.series_id ?? session.id;
    const off = new Set(optouts.data.filter((o) => o.series_or_session_id === key).map((o) => o.reader_id));
    const startsAt = Date.parse(session.starts_at);

    // One send per local time: the line carries each reader's own clock.
    const byTime = new Map<string, string[]>();
    for (const m of members.data) {
      if (m.group_id !== group.id || off.has(m.reader_id)) continue;
      const time = wallTime(startsAt, zoneOf.get(m.reader_id) ?? group.timezone);
      byTime.set(time, [...(byTime.get(time) ?? []), m.reader_id]);
    }
    for (const [time, ids] of byTime) {
      const sent = await notifyReaders(ids, {
        kind: "session_soon",
        groupId: group.id,
        title: `Session ${startsIn(startsAt, now)} · ${session.topic}, ${time}`,
        body: group.name,
        url: groupHref(group.slug),
        tag: `group-session-${session.id}`,
        ref: session.id,
      });
      tally.readers += sent.readers;
      tally.pushed += sent.pushed;
      tally.emailed += sent.emailed;
    }
  }
  return tally;
}

/** A group room's next session, for the Room ended card: the first one
 * still to start that isn't this room's own. Null for a standalone room or
 * with nothing scheduled. */
export async function nextSessionForRoom(roomId: string, readerId: string): Promise<NextSession | null> {
  const { data: room, error } = await getSupabaseAdminClient().from("rooms").select("group_id, session_id").eq("id", roomId).single();
  if (error) throw error;
  const group = room.group_id ? await findGroupById(room.group_id) : null;
  if (!group) return null;
  const now = Date.now();
  const { upcoming } = await getSessionsView(group, readerId, { detail: false });
  const session = upcoming.find((s) => s.id !== room.session_id && Date.parse(s.startsAt) > now);
  return session ? { groupSlug: group.slug, groupName: group.name, session } : null;
}

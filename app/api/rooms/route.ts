import { getAuthenticatedReader } from "@/lib/auth/session";
import { forbidden, notFound, unauthorized, validationError } from "@/lib/api/errors";
import { UUID_RE } from "@/lib/materials/resolve";
import { findGroup, groupResponse } from "@/lib/groups/membership";
import { notifyRoomLive } from "@/lib/groups/rooms";
import { inviteReaders, liveRoomOn } from "@/lib/room/invite";
import { joinResponse, joinRoom, startRoom } from "@/lib/room/server";

/**
 * `POST /api/rooms` — room-start (reading-room-spec.md §7). Any signed-in
 * reader may start a room on a public book (interim host,
 * reading-room-tasks.md); if that book already has a live room, this joins
 * it instead. A new room sends `room_live` to the book's readers today
 * (lib/room/invite). With `groupSlug` (studygroup-spec §11, M11): the
 * group's moderators only, optionally for one of its sessions
 * (`sessionId`); if the group already has a live room, this joins it, and a
 * new one sends `room_live` to the members. Returns the room-join payload
 * either way.
 */
export async function POST(request: Request) {
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as {
    materialId?: unknown;
    title?: unknown;
    groupSlug?: unknown;
    sessionId?: unknown;
  };
  if (typeof body.materialId !== "string" || !UUID_RE.test(body.materialId)) {
    return validationError("materialId is required.", "materialId");
  }
  if (body.title != null && typeof body.title !== "string") return validationError("title must be text.", "title");
  if (body.groupSlug != null && typeof body.groupSlug !== "string") return validationError("groupSlug must be text.", "groupSlug");
  if (body.sessionId != null && (typeof body.sessionId !== "string" || !UUID_RE.test(body.sessionId))) {
    return validationError("sessionId must be a session id.", "sessionId");
  }

  const group = body.groupSlug ? await findGroup(body.groupSlug) : null;
  if (body.groupSlug && !group) return groupResponse("not_found");
  const host = group ? { groupId: group.id, sessionId: (body.sessionId as string | undefined) ?? null } : null;
  const wasLive = group ? null : await liveRoomOn(body.materialId);
  const roomId = await startRoom(reader.readerId, body.materialId, (body.title as string | undefined) ?? null, host);
  if (!roomId) return group ? forbidden("Only the group's moderators can start its room, on a public book.") : notFound("Rooms can only be started on public books.");

  const joined = await joinRoom(reader.readerId, roomId);
  if ("payload" in joined) {
    // A new room invites; joining a live one doesn't (group pushes dedupe on the room).
    if (group) {
      if (joined.payload.room.startedBy === reader.readerId) notifyRoomLive(group, reader.readerId, roomId, joined.payload.room.title);
    } else if (!wasLive) {
      inviteReaders(joined.payload.room, reader.readerId);
    }
  }
  return joinResponse(joined);
}

// Shapes shared by the room routes (server) and lib/room/api.ts (client).

import type { Avatar } from "@/lib/avatar/avatar";
import type { GroupLiveRoom, GroupSession } from "@/lib/groups/types";
import type { Comrade } from "@/lib/rooms/types";

export type RoomInfo = {
  id: string;
  materialId: string;
  /** Already resolved through roomTitle(), never null. */
  title: string;
  bookTitle: string;
  bookAuthor: string;
  /** For the reader's URL, `/reader/{bookSlug}`. */
  bookSlug: string;
  startedBy: string;
  startedAt: string;
  maxMembers: number;
  /** The host group of a group room (studygroup-spec §11); null standalone. */
  group: { id: string; slug: string; name: string } | null;
};

/** What room-start and room-join return (spec §7): everything a client
 * needs to enter the room. */
export type RoomJoinPayload = {
  room: RoomInfo;
  /** Display only; the server authorises moderator actions itself. */
  isModerator: boolean;
  /** The joining reader as others see them, from their `readers` row; it
   * goes into presence (events.ts). */
  me: { name: string; avatar: Avatar };
  /** Receivers honour `summon` only from these (reading-room-tasks.md log). */
  moderatorIds: string[];
  iceServers: RTCIceServer[];
  /** For the room's own Realtime client. The publishable key is public by design. */
  supabase: { url: string; key: string };
};

/** What a room's link (/room/{id}) shows before you join
 * (GET /api/rooms/{roomId}), signed in or out. */
export type RoomInvite = {
  id: string;
  title: string;
  live: boolean;
  /** In the room now; 0 once it ended. */
  members: number;
  /** "Comrade Yeast"; null if their account is gone. */
  host: string | null;
  hostId: string;
  /** A few of those in, by face, the host first when they're in. */
  people: Comrade[];
  materialId: string;
  bookTitle: string;
  bookAuthor: string;
  bookSlug: string;
  cover: string | null;
};

/** Who a room-start is for: a group (its moderators only) and, optionally,
 * the session (studygroup-spec §11). Absent for a standalone room. */
export type RoomStartHost = { groupSlug: string; sessionId: string | null };

/** A book's room state, for the Live chip and "Start a room"
 * (GET /api/materials/{materialId}/room). */
export type MaterialRoom = {
  /** Public, published books only (start_room's rule). */
  canStart: boolean;
  /** Its card in the book room (6c) as well as the chip. */
  live: (GroupLiveRoom & { maxMembers: number }) | null;
};

/** The ended screen (spec §3.4), for readers who joined the room
 * (GET /api/rooms/{roomId}/summary). */
export type RoomSummary = {
  title: string;
  bookTitle: string;
  startedAt: string;
  endedAt: string | null;
  /** Total time the room sat at its cap. */
  fullSeconds: number;
  moderatorNames: string[];
  joined: { total: number; first: { readerId: string; name: string; avatar: Avatar }[] };
  /** A group room's next session, for its card (studygroup-spec §11). */
  next: NextSession | null;
};

/** The host group's next session (lib/groups/rooms.ts). */
export type NextSession = { groupSlug: string; groupName: string; session: GroupSession };

/** One beacon per visit, with the leave (spec §8.10). */
export type RoomLeaveStats = {
  peakMics: number;
  peakPeers: number;
  iceRestarts: number;
  usedTurn: boolean;
};

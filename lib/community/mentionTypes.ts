// Shared by the mentions route (server) and the composer (client).

import type { Avatar } from "@/lib/avatar/avatar";

/** The most comrades one note or invite can tag. */
export const MAX_MENTIONS = 20;

/** One tag suggestion. `role` is set when they're in the
 * group being posted to. */
export type MentionCandidate = {
  readerId: string;
  pseudonym: string;
  avatar: Avatar;
  role: "moderator" | "member" | null;
};

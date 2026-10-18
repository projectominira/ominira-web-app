// A room's day dividers (rooms-spec §4, sheet #c3): one rule for every
// stream. Pure.

import { formatDay } from "@/lib/time/format";
import { daysBetween, type LocalDay } from "@/lib/time/zone";

/** "Today", "Yesterday", else "Sun 4 Oct". */
export function dayLabel(day: LocalDay, today: LocalDay): string {
  const ago = daysBetween(day, today);
  if (ago === 0) return "Today";
  if (ago === 1) return "Yesterday";
  return formatDay(day, "day");
}

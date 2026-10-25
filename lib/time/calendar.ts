// Month grids for the date picker (studygroup-spec C4): weeks start on
// Monday. Pure, on local days (./zone.ts).

import { addDays, weekdayOf, type LocalDay } from "./zone";

/** The first day of `day`'s month, `n` months on. */
export function addMonths(day: LocalDay, n: number): LocalDay {
  const index = +day.slice(0, 4) * 12 + (+day.slice(5, 7) - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
}

export const sameMonth = (a: LocalDay, b: LocalDay) => a.slice(0, 7) === b.slice(0, 7);

/** Every day shown for `day`'s month, whole weeks Monday to Sunday: the
 * month itself, padded with the neighbouring months' days. */
export function monthGrid(day: LocalDay): LocalDay[] {
  const first = addMonths(day, 0);
  const start = addDays(first, -weekdayOf(first));
  const last = addDays(addMonths(day, 1), -1);
  const end = addDays(last, 6 - weekdayOf(last));
  const days: LocalDay[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

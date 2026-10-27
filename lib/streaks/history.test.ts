import { expect, test } from "bun:test";
import type { ReadingHistory } from "./types";
import { dayNote, longestRun, monthGrid, monthSummary, timeLabel, timeLong } from "./history";

const history: ReadingHistory = {
  year: 2026,
  today: "2026-11-20",
  goal: 30,
  days: [
    { day: "2026-10-30", seconds: 600, goal: 30, streak: null },
    // Read before time or goals were kept.
    { day: "2026-10-31", seconds: 0, goal: null, streak: "met" },
    { day: "2026-11-01", seconds: 3600, goal: 30, streak: "met" },
    { day: "2026-11-02", seconds: 1800, goal: 30, streak: "met" },
    { day: "2026-11-03", seconds: 0, goal: null, streak: "restored" },
    { day: "2026-11-04", seconds: 900, goal: 30, streak: null },
    { day: "2026-11-05", seconds: 2400, goal: 30, streak: "met" },
  ],
  firstDay: "2026-10-30",
};

test("a month's calendar starts on Monday and holds each of its days once", () => {
  // 1 Jan 2026 is a Thursday.
  expect(monthGrid(2026, 1).slice(0, 4)).toEqual([null, null, null, "2026-01-01"]);
  expect(monthGrid(2026, 1).filter(Boolean)).toHaveLength(31);
  expect(monthGrid(2028, 2).filter(Boolean)).toHaveLength(29);
  expect(monthGrid(2026, 12).at(-1)).toBe("2026-12-31");
});

test("time labels", () => {
  expect(timeLabel(30)).toBe("Under a minute");
  expect(timeLabel(45 * 60)).toBe("45 min");
  expect(timeLabel(2 * 3600)).toBe("2 h");
  expect(timeLabel(2 * 3600 + 5 * 60 + 59)).toBe("2 h 5 min");
  expect(timeLong(30)).toBe("under a minute");
  expect(timeLong(60)).toBe("1 minute");
  expect(timeLong(24 * 60)).toBe("24 minutes");
  expect(timeLong(3600)).toBe("1 hour");
  expect(timeLong(2 * 3600 + 40 * 60)).toBe("2 hours 40 minutes");
});

test("the longest run crosses months; a gap starts over", () => {
  expect(longestRun([])).toBe(0);
  expect(longestRun(history.days.filter((d) => d.streak).map((d) => d.day))).toBe(4);
});

test("a month at a glance: days under the goal are read, not streak days", () => {
  expect(monthSummary(history, 11)).toEqual({ seconds: 8700, daysRead: 4, goalDays: 3, longestRun: 3, longestDay: { day: "2026-11-01", seconds: 3600 } });
  expect(monthSummary(history, 10)).toMatchObject({ seconds: 600, daysRead: 2, goalDays: 1, longestRun: 1 });
  expect(monthSummary(history, 3)).toEqual({ seconds: 0, daysRead: 0, goalDays: 0, longestRun: 0, longestDay: null });
});

test("a picked day against its goal", () => {
  const note = (day: string) => dayNote(day, history.days.find((d) => d.day === day), history.today);
  expect(note("2026-11-01")).toBe("You read for 1 hour.");
  expect(note("2026-11-04")).toBe("You read for 15 minutes.");
  expect(note("2026-10-31")).toBe("You read and kept your streak.");
  expect(note("2026-11-03")).toBe("You didn’t read, but Restore kept your streak.");
  expect(note("2026-11-10")).toBe("You didn’t read.");
  expect(note(history.today)).toBe("You haven’t read yet today.");
  expect(dayNote(history.today, { day: history.today, seconds: 1440, goal: 60, streak: null }, history.today)).toBe("You’ve read for 24 minutes so far.");
});

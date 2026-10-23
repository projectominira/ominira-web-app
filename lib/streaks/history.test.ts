import { expect, test } from "bun:test";
import type { ReadingHistory } from "./types";
import { longestRun, monthGrid, monthSummary, shade, timeLabel } from "./history";

const history: ReadingHistory = {
  year: 2026,
  today: "2026-11-20",
  days: [
    { day: "2026-10-30", seconds: 600 },
    { day: "2026-10-31", seconds: 0 },
    { day: "2026-11-01", seconds: 3600 },
    { day: "2026-11-02", seconds: 120 },
    { day: "2026-11-05", seconds: 60 },
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

test("shades step up with minutes; a day read without time still shows", () => {
  expect(shade(false, 0)).toBe(0);
  expect(shade(true, 0)).toBe(1);
  expect(shade(true, 10 * 60)).toBe(2);
  expect(shade(true, 30 * 60)).toBe(3);
  expect(shade(true, 90 * 60)).toBe(4);
});

test("time labels", () => {
  expect(timeLabel(30)).toBe("Under a minute");
  expect(timeLabel(45 * 60)).toBe("45 min");
  expect(timeLabel(2 * 3600)).toBe("2 h");
  expect(timeLabel(2 * 3600 + 5 * 60 + 59)).toBe("2 h 5 min");
});

test("the longest run crosses months; a gap starts over", () => {
  expect(longestRun([])).toBe(0);
  expect(longestRun(history.days.map((d) => d.day))).toBe(4);
});

test("a month at a glance", () => {
  expect(monthSummary(history, 11)).toEqual({ seconds: 3780, daysRead: 3, longestRun: 2, bestDay: { day: "2026-11-01", seconds: 3600 } });
  expect(monthSummary(history, 10)).toMatchObject({ seconds: 600, daysRead: 2, longestRun: 2 });
  expect(monthSummary(history, 3)).toEqual({ seconds: 0, daysRead: 0, longestRun: 0, bestDay: null });
});

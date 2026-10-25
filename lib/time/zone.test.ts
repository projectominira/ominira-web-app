import { expect, test } from "bun:test";
import { addDays, daysBetween, isValidTimeZone, localDay, localMinutes, weekdayOf, zonedTime } from "./zone";

const at = (iso: string) => Date.parse(iso);

test("localDay crosses midnight per zone", () => {
  const instant = at("2026-10-09T23:30:00Z");
  expect(localDay(instant, "UTC")).toBe("2026-10-09");
  expect(localDay(instant, "Africa/Lagos")).toBe("2026-10-10");
  expect(localDay(instant, "America/New_York")).toBe("2026-10-09");
  expect(localMinutes(instant, "Africa/Lagos")).toBe(30);
});

test("day arithmetic", () => {
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
  expect(daysBetween("2026-10-09", "2026-10-12")).toBe(3);
  expect(daysBetween("2026-10-12", "2026-10-09")).toBe(-3);
  expect(weekdayOf("2026-10-12")).toBe(0); // Monday
  expect(weekdayOf("2026-10-11")).toBe(6); // Sunday
});

test("zonedTime keeps wall-clock time across DST", () => {
  expect(zonedTime("2026-10-22", "19:00", "Europe/London")).toBe(at("2026-10-22T18:00:00Z")); // BST
  expect(zonedTime("2026-10-29", "19:00", "Europe/London")).toBe(at("2026-10-29T19:00:00Z")); // GMT
  expect(zonedTime("2026-10-09", "08:00", "Africa/Lagos")).toBe(at("2026-10-09T07:00:00Z"));
  expect(zonedTime("2026-10-09", "19:00", "America/New_York")).toBe(at("2026-10-09T23:00:00Z"));
});

test("zonedTime in DST gaps and overlaps", () => {
  // 01:30 doesn't exist on 29 Mar in London: it lands after the gap, 02:30 BST.
  expect(zonedTime("2026-03-29", "01:30", "Europe/London")).toBe(at("2026-03-29T01:30:00Z"));
  // 01:30 happens twice on 25 Oct: the first (BST) one.
  expect(zonedTime("2026-10-25", "01:30", "Europe/London")).toBe(at("2026-10-25T00:30:00Z"));
});

test("isValidTimeZone", () => {
  expect(isValidTimeZone("Africa/Accra")).toBe(true);
  expect(isValidTimeZone("Mars/Olympus")).toBe(false);
});

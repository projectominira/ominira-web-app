import { expect, test } from "bun:test";
import { localDay } from "@/lib/time/zone";
import { dueSession, nextOccurrence, reminderDue, reminderKey, sessionPhase, SESSION_LENGTH, startsIn, wallTime, weeksLater } from "./sessions";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const at = (iso: string) => Date.parse(iso);

test("a session is upcoming, then soon an hour before, on for two hours, then past", () => {
  const start = at("2026-10-15T18:00:00Z");
  expect(sessionPhase(start, start - 61 * 60_000)).toBe("upcoming");
  expect(sessionPhase(start, start - HOUR)).toBe("soon");
  expect(sessionPhase(start, start)).toBe("on");
  expect(sessionPhase(start, start + SESSION_LENGTH - 1)).toBe("on");
  expect(sessionPhase(start, start + SESSION_LENGTH)).toBe("past");
  expect(reminderDue(start, start - 30 * 60_000)).toBe(true);
  expect(reminderDue(start, start)).toBe(false);
});

test("weekly keeps the wall-clock time where there's no DST", () => {
  const start = at("2026-10-15T18:00:00Z"); // 19:00 in Lagos
  expect(wallTime(start, "Africa/Lagos")).toBe("19:00");
  expect(weeksLater(start, "Africa/Lagos", 1)).toBe(start + 7 * DAY);
});

test("weekly keeps 19:00 across the autumn change (London, 25 Oct 2026)", () => {
  const start = at("2026-10-22T18:00:00Z"); // 19:00 BST
  const next = weeksLater(start, "Europe/London", 1);
  expect(wallTime(next, "Europe/London")).toBe("19:00");
  expect(localDay(next, "Europe/London")).toBe("2026-10-29");
  expect(next - start).toBe(7 * DAY + HOUR);
});

test("weekly keeps 19:00 across the spring change (New York, 14 Mar 2027)", () => {
  const start = at("2027-03-11T00:00:00Z"); // Wed 10 Mar 19:00 EST
  const next = weeksLater(start, "America/New_York", 1);
  expect(wallTime(next, "America/New_York")).toBe("19:00");
  expect(next - start).toBe(7 * DAY - HOUR);
});

test("a time inside a spring-forward gap lands just after it", () => {
  const start = at("2027-03-07T07:30:00Z"); // Sun 7 Mar 02:30 EST
  const next = weeksLater(start, "America/New_York", 1); // 02:30 doesn't exist on 14 Mar
  expect(wallTime(next, "America/New_York")).toBe("03:30");
});

test("the next occurrence waits until the latest is over", () => {
  const start = at("2026-10-15T18:00:00Z");
  const tz = "Africa/Lagos";
  expect(nextOccurrence({ startsAt: start, cancelled: false }, tz, start - DAY)).toBeNull();
  expect(nextOccurrence({ startsAt: start, cancelled: false }, tz, start + HOUR)).toBeNull();
  expect(nextOccurrence({ startsAt: start, cancelled: false }, tz, start + SESSION_LENGTH)).toBe(start + 7 * DAY);
});

test("a skipped occurrence brings the next one forward at once", () => {
  const start = at("2026-10-15T18:00:00Z");
  expect(nextOccurrence({ startsAt: start, cancelled: true }, "Africa/Lagos", start - 3 * DAY)).toBe(start + 7 * DAY);
});

test("a series left for weeks resumes at the first slot not yet over", () => {
  const start = at("2026-10-15T18:00:00Z");
  const tz = "Africa/Lagos";
  // Three weeks on, during that week's session: it's still on, so that's next.
  expect(nextOccurrence({ startsAt: start, cancelled: false }, tz, start + 21 * DAY + HOUR)).toBe(start + 21 * DAY);
  // Just after it: the week after.
  expect(nextOccurrence({ startsAt: start, cancelled: false }, tz, start + 21 * DAY + SESSION_LENGTH)).toBe(start + 28 * DAY);
});

test("opt-outs key on the series, or the single session", () => {
  expect(reminderKey({ id: "a", seriesId: "s" })).toBe("s");
  expect(reminderKey({ id: "a", seriesId: null })).toBe("a");
});

test("the reminder's lead", () => {
  const start = at("2026-10-15T18:00:00Z");
  expect(startsIn(start, start - 58 * 60_000)).toBe("in an hour");
  expect(startsIn(start, start - 20 * 60_000)).toBe("in 20 min");
});

test("the session a room is for: the first one soon or on", () => {
  const start = at("2026-10-15T18:00:00Z");
  const a = { startsAt: new Date(start).toISOString() };
  const b = { startsAt: new Date(start + DAY).toISOString() };
  expect(dueSession([a, b], start - 2 * HOUR)).toBeNull();
  expect(dueSession([a, b], start - 30 * 60_000)).toBe(a);
  expect(dueSession([a, b], start + HOUR)).toBe(a);
  expect(dueSession([b], start)).toBeNull();
});

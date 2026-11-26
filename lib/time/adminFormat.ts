/** "Sat 28 Nov" and "Sat 28 Nov, 07:00" in a fixed zone, built from parts so
 * the server and the browser print the same thing (their ICU punctuation
 * differs, which breaks hydration). */
const parts = (date: Date, zone: string, time: boolean) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: zone, ...(time && { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const }) })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );

export function shortDay(date: Date, zone = "UTC") {
  const p = parts(date, zone, false);
  return `${p.weekday} ${p.day} ${p.month}`;
}

export function shortDayTime(date: Date, zone = "Africa/Lagos") {
  const p = parts(date, zone, true);
  return `${p.weekday} ${p.day} ${p.month}, ${p.hour}:${p.minute}`;
}

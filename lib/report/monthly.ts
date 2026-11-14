/**
 * The monthly report for MAE leadership: the period's membership and
 * readership figures from the same SQL as /admin and the features shipped, set
 * in Typst and compiled to PDF.
 *
 * Two steps: `reportData()` gathers the figures and links the month's commits
 * (a public repo: Claude reads them itself, or the CLI from `git log`); the
 * caller writes the summary and the updates; `reportPdf()` sets the lot.
 */
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { getPeriodMetrics, type PeriodMetrics } from "@/lib/metrics/dashboard";
import { periodLabel, shift, type Period } from "@/lib/metrics/period";
import { addDays, daysBetween, type LocalDay } from "@/lib/time/zone";
import { TEMPLATE } from "./template";

/** The web app's launch: the first day of the curves (a Monday, so weeks run Mon–Sun). */
const LAUNCH: LocalDay = "2026-09-21";
/** The September report's target: 95 members in the week ending 4 Oct, growing 10% a week. */
const TARGET = { day: "2026-10-04" as LocalDay, members: 95, weekly: 0.1 };
const REPO = "projectominira/ominira-web-app";
/** When each figure began to be recorded: active days, and reading time (reading history, 23 Oct). */
const READERS_SINCE: LocalDay = "2026-09-29";
const TIME_SINCE: LocalDay = "2026-10-23";

export type ReportData = {
  period: Period;
  label: string;
  previousLabel: string;
  now: Figures;
  before: Figures;
  /** Target members at the period's end, on the 10%/week path. */
  target: number;
  /** Each week since launch (Mon–Sun) up to the period's end, labelled by its Sunday. */
  /** Readers and hours are null in weeks before they were recorded. */
  weeks: { ending: LocalDay; members: number; target: number | null; readers: number | null; hours: number | null }[];
  /** The month's commits on GitHub, to write the updates from. */
  commits: string;
};

export type Figures = {
  members: number;
  joined: number;
  /** Average distinct readers a day, a 7-day stretch, and the month's distinct readers. */
  dau: number;
  wau: number;
  mau: number;
  seconds: number;
  listenSeconds: number | null;
};

export type ReportText = {
  /** Typst markup: a few sentences. `*bold*` and `_italic_` work. */
  summary: string;
  /** Typst markup, one line per feature shipped. */
  updates: string[];
  /** From Vercel Analytics, optional. */
  visitors?: number;
  pageViews?: number;
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

function figures(m: PeriodMetrics, current: boolean): Figures {
  const days = current ? m.days.slice(0, m.elapsed) : m.compareDays.slice(0, m.compared);
  const weeks = current ? m.weekReaders : m.compareWeekReaders;
  const listened = days.filter((d) => d.listenSeconds !== null);
  return {
    members: current ? m.members : m.membersCompare,
    joined: sum(days.map((d) => d.newMembers)),
    dau: mean(days.map((d) => d.readers)),
    wau: mean(weeks),
    mau: current ? m.readers : m.compareReadersAll,
    seconds: sum(days.map((d) => d.seconds)),
    listenSeconds: listened.length ? sum(listened.map((d) => d.listenSeconds!)) : null,
  };
}

const targetOn = (day: LocalDay) => TARGET.members * (1 + TARGET.weekly) ** (daysBetween(TARGET.day, day) / 7);

export async function reportData(period: Period): Promise<ReportData> {
  const previous = shift(period, -1);
  const end = addDays(period.start, period.days);
  // The whole run since launch, for the weekly curves: whole weeks only.
  const span = Math.ceil(daysBetween(LAUNCH, end) / 7) * 7;
  const [m, run] = await Promise.all([
    getPeriodMetrics(period, previous),
    // Its comparison is unused: one day keeps it cheap.
    getPeriodMetrics({ view: "week", start: LAUNCH, days: span }, { view: "week", start: LAUNCH, days: 1 }),
  ]);

  let members = run.membersAtStart;
  const weeks = run.weekReaders.map((readers, i) => {
    const days = run.days.slice(i * 7, i * 7 + 7);
    members += sum(days.map((d) => d.newMembers));
    const ending = addDays(LAUNCH, i * 7 + 6);
    return { ending, members, target: ending >= TARGET.day ? Math.round(targetOn(ending)) : null, readers: ending >= READERS_SINCE ? readers : null,
      hours: ending >= TIME_SINCE ? Math.round(sum(days.map((d) => d.seconds)) / 360) / 10 : null };
  });

  return {
    period,
    label: periodLabel(period),
    previousLabel: periodLabel(previous),
    now: figures(m, true),
    before: figures(m, false),
    target: Math.round(targetOn(addDays(end, -1))),
    weeks,
    commits: `https://github.com/${REPO}/commits/main/?since=${period.start}&until=${addDays(end, -1)}`,
  };
}

// ── Formatting: the template gets strings only ──────────────────────────────

const count = (n: number) => Math.round(n).toLocaleString("en");
const pct = (n: number) => `${Math.round(n * 100)}%`;
const hours = (s: number) => `${count(s / 3600)} h`;
const minutes = (s: number) => `${Math.round(s / 60)} min`;
const change = (a: number, b: number) => (b > 0 ? `${a >= b ? "+" : "−"}${Math.round(Math.abs(a / b - 1) * 100)}%` : "–");
const dayMonth = (d: LocalDay) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

export function reportPdf(data: ReportData, text: ReportText): Buffer {
  const { now, before } = data;
  const row = (label: string, a: string, b: string, delta: string) => ({ label, now: a, before: b, change: delta });
  const behind = data.target - now.members;

  const membership = [
    row("Members", count(now.members), count(before.members), change(now.members, before.members)),
    row("New members", count(now.joined), count(before.joined), change(now.joined, before.joined)),
    ...(text.visitors ? [row("Visitors", count(text.visitors), "", ""), row("Conversion (visitors who joined)", pct(now.joined / text.visitors), "", "")] : []),
    ...(text.pageViews ? [row("Page views", count(text.pageViews), "", "")] : []),
  ];
  const prevStart = shift(data.period, -1).start;
  const readersThen = prevStart >= READERS_SINCE;
  const timeThen = prevStart >= TIME_SINCE;
  const was = (ok: boolean, a: string, b: string): [string, string] => (ok ? [a, b] : ["–", "–"]);
  const readership = [
    row("Daily active readers (avg)", count(now.dau), ...was(readersThen, count(before.dau), change(now.dau, before.dau))),
    row("Weekly active readers (avg)", count(now.wau), ...was(readersThen, count(before.wau), change(now.wau, before.wau))),
    row("Monthly active readers", count(now.mau), ...was(readersThen, count(before.mau), change(now.mau, before.mau))),
    row("Members active this month", pct(now.mau / now.members), ...was(readersThen, pct(before.mau / (before.members || 1)), "")),
    row("Stickiness (daily ÷ monthly)", pct(now.dau / (now.mau || 1)), ...was(readersThen, pct(before.dau / (before.mau || 1)), "")),
    row("Reading time", hours(now.seconds), ...was(timeThen, hours(before.seconds), change(now.seconds, before.seconds))),
    row("Per active reader", minutes(now.seconds / (now.mau || 1)), ...was(timeThen, minutes(before.seconds / (before.mau || 1)), "")),
    ...(now.listenSeconds !== null ? [row("Listened (audio)", pct(now.listenSeconds / (now.seconds || 1)), before.listenSeconds !== null ? pct(before.listenSeconds / (before.seconds || 1)) : "–", "")] : []),
  ];

  // Days of the month with reading time recorded: from TIME_SINCE to its end, within the month.
  const timeDays = Math.max(0, Math.min(data.period.days, daysBetween(TIME_SINCE, addDays(data.period.start, data.period.days))));

  const input = {
    // The same PIN /admin/unlock checks (lib/admin/pin.ts); never in the source, the repo is public.
    adminPin: process.env.ADMIN_PIN?.trim() || null,
    label: data.label,
    previous: data.previousLabel,
    summary: text.summary,
    updates: text.updates,
    membership,
    readership,
    caveats: [
      ...(!readersThen ? [`Active readers were first recorded on ${dayMonth(READERS_SINCE)}, so there is no ${data.previousLabel} comparison.`] : []),
      ...(timeDays < data.period.days ? [`Reading time was first recorded on ${dayMonth(TIME_SINCE)}, so it covers only ${timeDays} day${timeDays === 1 ? "" : "s"} of ${data.label}.`] : []),
    ],
    target: `On the 10%-a-week path, the target for ${dayMonth(addDays(data.period.start, data.period.days - 1))} was ${count(data.target)} members, so we are ${behind > 0 ? `${count(behind)} behind` : behind < 0 ? `${count(-behind)} ahead` : "on target"}.`,
    weeks: data.weeks.map((w) => dayMonth(w.ending)),
    members: data.weeks.map((w) => w.members),
    targets: data.weeks.map((w) => w.target),
    readers: data.weeks.map((w) => w.readers),
    hours: data.weeks.map((w) => w.hours),
  };

  const compiler = NodeCompiler.create();
  const compiled = compiler.compile({ mainFileContent: TEMPLATE, inputs: { data: JSON.stringify(input) } });
  if (!compiled.result) {
    const problems = (compiled.takeError()?.shortDiagnostics ?? []) as { message: string }[];
    throw new Error(problems.map((p) => p.message).join("; ") || "Typst failed");
  }
  return compiler.pdf(compiled.result);
}

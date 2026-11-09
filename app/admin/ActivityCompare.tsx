"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { formatDuration } from "@/lib/time/duration";

/** One day: its date, readers and minutes read, null before it has begun. */
export type ActivityPoint = { day: string; label: string; readers: number | null; minutes: number | null };

/** One row of a period's breakdown (a day, or a 7-day stretch), already
 * formatted; null figures haven't begun. */
export type BreakdownRow = { label: string; readers: string | null; time: string | null; joined: string | null };

export type ActivityPanel = {
  title: string;
  caption: string;
  points: ActivityPoint[];
  rows: BreakdownRow[];
  total: BreakdownRow;
  /** The period being looked at (accent) or what it's compared with (neutral). */
  tone: "accent" | "neutral";
};

type Metric = "readers" | "minutes";

/** Steps a y-axis can take: readers in 1/2/5 × 10ⁿ, minutes in whole
 * clock units (5 min … 1 h, 2 h, 3 h, 6 h …). */
const READER_STEPS = [0, 1, 2, 3, 4, 5, 6].flatMap((e) => [1, 2, 5].map((m) => m * 10 ** e));
const MINUTE_STEPS = [5, 10, 15, 30, 60, 120, 180, 240, 360, 480, 720, 1440, 2880, 4320, 7200, 14400];
const INTERVALS = 4;

/** A y-axis from 0 in round steps, its top the first one at or above `max`,
 * so the scale reads cleanly and the two panels share it. */
function niceTicks(max: number, metric: Metric): number[] {
  const steps = metric === "readers" ? READER_STEPS : MINUTE_STEPS;
  const step = steps.find((s) => s * INTERVALS >= max) ?? Math.ceil(max / INTERVALS);
  return Array.from({ length: INTERVALS + 1 }, (_, i) => i * step);
}

const minutesLabel = (v: number) => (v < 60 ? `${v}m` : `${+(v / 60).toFixed(1)}h`);

const longDate = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const COLOR = { accent: "var(--reader-accent)", neutral: "var(--reader-text-muted)" };

/**
 * The period and its comparison, if any, side by side (stacked on phones): each a
 * chart of readers or time read per day, on one shared scale so heights
 * compare, with a y-axis of round steps from 0, over its own breakdown table, whose rows line up across the two.
 */
export default function ActivityCompare({ panels, ticks }: { panels: ActivityPanel[]; ticks: number[] }) {
  const [metric, setMetric] = useState<Metric>("readers");
  const yTicks = niceTicks(Math.max(0, ...panels.flatMap((p) => p.points.map((d) => d[metric] ?? 0))), metric);

  return (
    <section aria-labelledby="days-heading" className="mt-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="days-heading" className="m-0 text-[14px] font-bold text-[var(--reader-text)]">
          Reading activity
        </h2>
        <div role="group" aria-label="Chart" className="flex rounded-sm border border-sand-300 bg-[var(--reader-surface)] p-0.5 text-[12px] font-semibold">
          {(["readers", "minutes"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={metric === m}
              onClick={() => setMetric(m)}
              className={`h-7 cursor-pointer rounded-[3px] border-none px-2.5 transition-colors ${
                metric === m ? "bg-[var(--reader-surface-hover)] text-[var(--reader-text)]" : "bg-transparent text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]"
              }`}
            >
              {m === "readers" ? "Readers" : "Time read"}
            </button>
          ))}
        </div>
      </div>
      <div className={`grid grid-cols-1 gap-3 ${panels.length > 1 ? "lg:grid-cols-2" : ""}`}>
        {panels.map((panel) => (
          <Panel key={panel.tone} panel={panel} metric={metric} yTicks={yTicks} ticks={ticks} />
        ))}
      </div>
    </section>
  );
}

function Panel({ panel, metric, yTicks, ticks }: { panel: ActivityPanel; metric: Metric; yTicks: number[]; ticks: number[] }) {
  const color = COLOR[panel.tone];
  const id = `wash-${panel.tone}`;
  return (
    <div className="min-w-0 rounded-sm border border-[var(--reader-border)] p-4 shell:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="m-0 flex items-center gap-2 text-[14px] font-bold text-[var(--reader-text)]">
          <span className="h-2 w-2 flex-none rounded-full" style={{ background: color }} aria-hidden />
          {panel.title}
        </h3>
        <span className="text-[12px] font-medium text-[var(--reader-text-muted)]">{panel.caption}</span>
      </div>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={panel.points.map((p, i) => ({ ...p, i }))} margin={{ top: 6, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.14} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--reader-border)" />
            <XAxis
              dataKey="i"
              type="number"
              domain={[0, panel.points.length - 1]}
              ticks={ticks.filter((t) => t < panel.points.length)}
              tickFormatter={(i: number) => panel.points[i]?.label ?? ""}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--reader-text-muted)" }}
              tickMargin={6}
            />
            <YAxis
              domain={[0, yTicks[yTicks.length - 1]]}
              ticks={yTicks}
              interval={0}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fontSize: 11, fill: "var(--reader-text-muted)" }}
              tickFormatter={(v: number) => (metric === "minutes" ? minutesLabel(v) : v.toLocaleString("en"))}
            />
            <Tooltip content={(props) => <PointTooltip {...props} metric={metric} color={color} />} cursor={{ stroke: "var(--reader-text-subtle)", strokeWidth: 1 }} isAnimationActive={false} />
            <Area
              type="monotone"
              dataKey={metric}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${id})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--reader-surface)", fill: color }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <table className="mt-4 w-full border-collapse text-[13px] tabular-nums">
        <thead>
          <tr className="text-[12px] font-semibold text-[var(--reader-text-muted)]">
            <th scope="col" className="py-2 text-left font-semibold">
              <span className="sr-only">Day</span>
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              Readers
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              Time read
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              New members
            </th>
          </tr>
        </thead>
        <tbody>
          {panel.rows.map((row) => (
            <BreakdownLine key={row.label} row={row} />
          ))}
          <BreakdownLine row={panel.total} total />
        </tbody>
      </table>
    </div>
  );
}

function BreakdownLine({ row, total }: { row: BreakdownRow; total?: boolean }) {
  const cell = (v: string | null) => (v === null ? <span className="text-[var(--reader-text-subtle)]">–</span> : v);
  return (
    <tr className={`border-t border-[var(--reader-border)] text-[var(--reader-text)] ${total ? "font-bold" : ""}`}>
      <th scope="row" className="py-2 text-left font-semibold whitespace-nowrap">
        {row.label}
      </th>
      <td className="py-2 text-right">{cell(row.readers)}</td>
      <td className="py-2 text-right whitespace-nowrap">{cell(row.time)}</td>
      <td className="py-2 text-right">{cell(row.joined)}</td>
    </tr>
  );
}

function PointTooltip({ active, payload, metric, color }: TooltipContentProps<ValueType, NameType> & { metric: Metric; color: string }) {
  const point = active ? (payload?.[0]?.payload as ActivityPoint | undefined) : undefined;
  if (!point) return null;
  const v = point[metric];
  const text =
    v === null ? "Not yet" : metric === "readers" ? `${v.toLocaleString("en")} ${v === 1 ? "reader" : "readers"}` : `${v ? formatDuration(v * 60_000) : "0 min"} read`;
  return (
    <div className="min-w-[150px] rounded-[var(--radius-sm)] border border-[var(--reader-border)] bg-[var(--reader-surface)] px-3 py-2.5 shadow-lg">
      <p className="m-0 text-[11px] font-semibold text-[var(--reader-text-muted)]">{longDate.format(new Date(`${point.day}T00:00:00Z`))}</p>
      <p className="m-0 mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--reader-text)]">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
        {text}
      </p>
    </div>
  );
}

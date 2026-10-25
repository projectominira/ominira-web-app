"use client";

import { Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { formatDuration } from "@/lib/time/duration";

/** One day: its readers and minutes read, both null before the day has begun. */
export type ActivityPoint = { day: string; readers: number | null; minutes: number | null };

// `day` is a calendar date ("2026-10-19"); format it as UTC so it never
// shifts a day in a browser west of Greenwich.
const shortDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const formatDay = (day: string, format = shortDate) => format.format(new Date(`${day}T00:00:00Z`));

/**
 * Readers and minutes read per day over four Monday–Sunday weeks, the
 * selected week shaded. Readers are the accent line over a ~10% wash on the
 * left axis; minutes a neutral line on the right axis. Hairline horizontal
 * grid, a tick on each Monday, and a crosshair tooltip with both figures.
 */
export default function ActivityChart({ data, weekStart }: { data: ActivityPoint[]; weekStart: string }) {
  const mondays = data.filter((_, i) => i % 7 === 0).map((d) => d.day);

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: -16, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="activity-wash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--reader-accent)" stopOpacity={0.14} />
              <stop offset="100%" stopColor="var(--reader-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--reader-border)" />
          <ReferenceArea yAxisId="readers" x1={weekStart} x2={data[data.length - 1].day} fill="var(--reader-text-subtle)" fillOpacity={0.08} />
          <XAxis
            dataKey="day"
            ticks={mondays}
            tickFormatter={(day: string) => formatDay(day)}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "var(--reader-text-muted)" }}
            tickMargin={8}
          />
          <YAxis
            yAxisId="readers"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fontSize: 12, fill: "var(--reader-text-muted)" }}
          />
          <YAxis
            yAxisId="minutes"
            orientation="right"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fontSize: 12, fill: "var(--reader-text-muted)" }}
          />
          <Tooltip
            content={ActivityTooltip}
            cursor={{ stroke: "var(--reader-text-subtle)", strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <Area
            yAxisId="minutes"
            type="monotone"
            dataKey="minutes"
            name="Time read"
            stroke="var(--reader-text-muted)"
            strokeWidth={1.5}
            fill="none"
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--reader-surface)", fill: "var(--reader-text-muted)" }}
            isAnimationActive={false}
          />
          <Area
            yAxisId="readers"
            type="monotone"
            dataKey="readers"
            name="Readers"
            stroke="var(--reader-accent)"
            strokeWidth={2}
            fill="url(#activity-wash)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--reader-surface)", fill: "var(--reader-accent)" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ActivityTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  const point = active ? (payload?.[0]?.payload as ActivityPoint | undefined) : undefined;
  if (!point || point.readers === null) return null;

  return (
    <div className="min-w-[160px] rounded-[var(--radius-sm)] border border-[var(--reader-border)] bg-[var(--reader-surface)] px-3 py-2.5 shadow-lg">
      <p className="m-0 mb-1.5 text-[11px] font-semibold text-[var(--reader-text-muted)]">{formatDay(point.day, longDate)}</p>
      <p className="m-0 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--reader-text)]">
        <span className="h-2 w-2 rounded-full bg-[var(--reader-accent)]" aria-hidden />
        {point.readers.toLocaleString("en")} readers
      </p>
      <p className="m-0 mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--reader-text)]">
        <span className="h-2 w-2 rounded-full bg-[var(--reader-text-muted)]" aria-hidden />
        {point.minutes ? formatDuration(point.minutes * 60_000) : "0 min"} read
      </p>
    </div>
  );
}

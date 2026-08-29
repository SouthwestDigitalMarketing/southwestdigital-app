"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import { goalColors, goalSegments, type GoalBand } from "./goal-colors";

export type TrafficComparisonRow = {
  date: string; // "YYYY-MM-DD" for daily, "YYYY-MM-DDTHH:00:00" for hourly
  current: number;
  previous: number;
};

type Props = {
  rows: TrafficComparisonRow[];
  goal: number;
  label: string;
  granularity: "daily" | "hourly";
};

const PACE_BANDS: { key: GoalBand; color: string }[] = [
  { key: "rose", color: goalColors(0).bar },
  { key: "orange", color: goalColors(25).bar },
  { key: "amber", color: goalColors(50).bar },
  { key: "lime", color: goalColors(75).bar },
  { key: "emerald", color: goalColors(100).bar },
];

function formatK(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtAxisTick(value: string, granularity: "daily" | "hourly") {
  if (granularity === "daily") {
    const d = new Date(value + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  const d = new Date(value);
  const h = d.getHours();
  if (h === 0) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }).replace(":00", "");
}

function fmtTooltipDate(value: string, granularity: "daily" | "hourly") {
  if (granularity === "daily") {
    return new Date(value + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
  }
  const d = new Date(value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }).replace(":00", "");
}

function DateTick({
  x,
  y,
  payload,
  granularity,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
  granularity: "daily" | "hourly";
}) {
  if (!payload?.value) return null;
  const date = granularity === "daily"
    ? new Date(`${payload.value}T00:00:00`)
    : new Date(payload.value);
  const isMonday = date.getDay() === 1;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={4}
        textAnchor="end"
        fill={isMonday ? "var(--text-secondary)" : "var(--chart-muted)"}
        fontSize={9}
        fontWeight={isMonday ? 700 : 400}
        transform="rotate(-45)"
      >
        {fmtAxisTick(payload.value, granularity)}
      </text>
    </g>
  );
}

export function SiteTrafficGraph({ rows, goal, label, granularity }: Props) {
  const total = rows.reduce((s, r) => s + r.current, 0);
  const prevTotal = rows.reduce((s, r) => s + r.previous, 0);
  const pctChange = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
  const isUp = pctChange !== null && pctChange >= 0;
  const targetPerBucket = rows.length > 0 && goal > 0 ? goal / rows.length : 0;
  const bucketLabel = granularity === "daily" ? "day" : "hour";
  const paceLabel = granularity === "daily" ? "daily" : "hourly";
  const chartTitle = granularity === "daily" ? "Daily engaged sessions" : "Hourly engaged sessions";
  const chartRows = rows.map((row) => ({
    ...row,
    ...goalSegments(row.current, targetPerBucket),
  }));

  function pacePct(value: number) {
    return targetPerBucket > 0 ? (value / targetPerBucket) * 100 : 0;
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{chartTitle}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
            {total.toLocaleString("en-US")} total — {label.toLowerCase()}
          </p>
          {pctChange !== null ? (
            <p className={`mt-0.5 text-xs font-medium ${isUp ? "text-emerald-600" : "text-amber-600"}`}>
              {isUp ? "+" : ""}{pctChange.toFixed(1)}% vs. prev. period
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-400">No comparison data</p>
          )}
        </div>

        <div className="flex items-center gap-5 pb-0.5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="flex gap-0.5" aria-hidden="true">
              {PACE_BANDS.map(({ key, color }) => (
                <span key={key} className="inline-block h-2.5 w-1.5 rounded-sm" style={{ background: color }} />
              ))}
            </span>
            Goal pace
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="18" height="4" className="shrink-0">
              <line x1="0" y1="2" x2="18" y2="2" stroke="var(--chart-muted)" strokeWidth="1.5" strokeDasharray="4 3" />
            </svg>
            Previous
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartRows} margin={{ top: 24, right: 4, left: 8, bottom: 36 }} barCategoryGap="25%">
          <XAxis
            dataKey="date"
            tick={<DateTick granularity={granularity} />}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            tickFormatter={formatK}
            tick={{ fontSize: 10, fill: "var(--chart-muted)" }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            content={({ active, payload, label: lbl }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as TrafficComparisonRow | undefined;
              const currentValue = Number(row?.current ?? 0);
              const currentPace = pacePct(currentValue);
              const paceColor = goalColors(currentPace).bar;
              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                  <p className="mb-1 font-semibold text-slate-700">{fmtTooltipDate(String(lbl), granularity)}</p>
                  <p className="text-slate-900">{currentValue.toLocaleString("en-US")} engaged sessions</p>
                  <p className="text-slate-400">prev. {Number(row?.previous ?? 0).toLocaleString("en-US")}</p>
                  <p className="mt-1 font-semibold" style={{ color: paceColor }}>
                    {Math.round(currentPace)}% of {paceLabel} pace
                  </p>
                </div>
              );
            }}
            cursor={{ fill: "var(--chart-cursor)" }}
          />
          {PACE_BANDS.map(({ key, color }, index) => (
            <Bar key={key} dataKey={key} stackId="current" fill={color}>
              {index === PACE_BANDS.length - 1 ? (
                <LabelList
                  dataKey="current"
                  position="top"
                  fill="var(--text-secondary)"
                  fontSize={9}
                />
              ) : null}
            </Bar>
          ))}
          <Line
            dataKey="previous"
            stroke="var(--chart-muted)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            activeDot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-slate-400">
        Each bar is measured against {targetPerBucket.toLocaleString("en-US", { maximumFractionDigits: 1 })} engaged sessions per {bucketLabel}:
        {" "}rose &lt;25%, orange 25–49%, amber 50–74%, lime 75–99%, emerald 100%+.
      </p>
    </div>
  );
}

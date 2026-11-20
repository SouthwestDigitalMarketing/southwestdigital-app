"use client";

import { useState, useSyncExternalStore } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { ScorecardData } from "@/lib/scorecard/types";
import {
  PHONE_MAX_DAILY_POINTS,
  dailyShareRows,
  dailyTimeRows,
  weeklyShareRows,
  weeklyTimeRows,
  hourTicks,
  type ShareRow,
  type TimeRow,
} from "./chart-buckets";
import { formatDuration } from "./format";

type Series = ScorecardData["series"];
type MeasureKey = "texts" | "emails" | "callbacks";

const MEASURES: { key: MeasureKey; label: string }[] = [
  { key: "texts", label: "Texts" },
  { key: "emails", label: "Emails" },
  { key: "callbacks", label: "Callbacks" },
];

// Tailwind's `sm` breakpoint, as in website/SiteTrafficGraph.tsx.
const PHONE_QUERY = "(max-width: 639px)";

function subscribePhone(onChange: () => void) {
  const mql = window.matchMedia(PHONE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function useIsPhone() {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

function fmtDay(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

function fmtBucket(row: { date: string; endDate: string; days: number }) {
  return row.days > 1 ? `${fmtDay(row.date)} – ${fmtDay(row.endDate)}` : fmtDay(row.date);
}

// Hours on the axis: "30m", "2h", "1.5d" (24-hour days).
function fmtHoursTick(hours: number) {
  if (hours === 0) return "0";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

// About five evenly spaced labels, anchored on the newest point.
function tickIndexes(total: number) {
  const step = Math.max(1, Math.ceil(total / 5));
  return new Set(Array.from({ length: total }, (_, i) => i).filter((i) => (total - 1 - i) % step === 0));
}

function AxisTick({
  x,
  y,
  index,
  rows,
}: {
  x?: number;
  y?: number;
  index?: number;
  rows: { date: string }[];
}) {
  const i = index ?? -1;
  const row = rows[i];
  if (!row || !tickIndexes(rows.length).has(i)) return null;
  return (
    <text
      x={x}
      y={y}
      dy={12}
      textAnchor={i === rows.length - 1 ? "end" : "middle"} // keep the newest label inside the card
      fill="var(--text-secondary)"
      fontSize={11}
    >
      {fmtDay(row.date)}
    </text>
  );
}

export function ScorecardCharts({
  series,
  targetSeconds,
}: {
  series: Series;
  /** Business-seconds target per measure, drawn as a dotted line. */
  targetSeconds: Record<MeasureKey, number>;
}) {
  const isPhone = useIsPhone();
  const [measure, setMeasure] = useState<MeasureKey>("texts");
  const weekly = isPhone && series.texts.length > PHONE_MAX_DAILY_POINTS;
  const points = series[measure];
  const timeRows: TimeRow[] = weekly ? weeklyTimeRows(points) : dailyTimeRows(points);
  const shareRows: ShareRow[] = weekly
    ? weeklyShareRows(series.callsAnsweredShare)
    : dailyShareRows(series.callsAnsweredShare);
  const targetHours = targetSeconds[measure] / 3600;
  const anyTime = timeRows.some((r) => r.medianHours !== null);
  const yTicks = hourTicks(Math.max(targetHours, ...timeRows.map((r) => r.p90Hours ?? r.medianHours ?? 0)));
  const anyCalls = shareRows.some((r) => r.sharePct !== null);

  return (
    <>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Response time, last 90 days
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Business hours. {weekly ? "One point per week." : "One point per day."}
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1" role="tablist">
            {MEASURES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={measure === key}
                onClick={() => setMeasure(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  measure === key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {anyTime ? (
          <div className={isPhone ? "[&_*:focus]:outline-none" : undefined}>
            <ResponsiveContainer width="100%" height={isPhone ? 200 : 240}>
              <LineChart data={timeRows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <XAxis
                  dataKey="date"
                  tick={<AxisTick rows={timeRows} />}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <YAxis
                  domain={[0, yTicks[yTicks.length - 1]]}
                  ticks={yTicks}
                  tickFormatter={fmtHoursTick}
                  tick={{ fontSize: 10, fill: "var(--chart-muted)" }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <ReferenceLine
                  y={targetHours}
                  stroke="var(--chart-muted)"
                  strokeDasharray="2 4"
                />
                <Tooltip
                  cursor={{ stroke: "var(--chart-cursor)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as TimeRow | undefined;
                    if (!row) return null;
                    return (
                      <div className="ui-tooltip rounded-lg px-3 py-2 text-xs shadow-sm">
                        <p className="mb-1 font-semibold">{fmtBucket(row)}</p>
                        {row.medianHours === null ? (
                          <p>No answered client contacts</p>
                        ) : (
                          <>
                            <p>Median {formatDuration(row.medianHours * 3600)}</p>
                            <p className="opacity-70">90th percentile {formatDuration((row.p90Hours ?? 0) * 3600)}</p>
                          </>
                        )}
                        <p className="mt-1 opacity-70">{row.count} needed an answer</p>
                      </div>
                    );
                  }}
                />
                <Line
                  dataKey="p90Hours"
                  stroke="var(--chart-series-4)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls
                />
                <Line
                  dataKey="medianHours"
                  stroke="var(--chart-series-1)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-slate-400">No client contacts in this range</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
          <Legend color="var(--chart-series-1)" label="Median" />
          <Legend color="var(--chart-series-4)" label="90th percentile" dashed />
          <Legend color="var(--chart-muted)" label={`Target, ${formatDuration(targetSeconds[measure])} business time`} dotted />
        </div>
        {weekly ? (
          <p className="mt-2 text-xs text-slate-400">
            On a phone each point is a week: the middle of that week&apos;s daily values, weighted by how
            many contacts each day had.
          </p>
        ) : null}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Calls answered live, last 90 days
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Share of incoming client calls picked up. {weekly ? "One bar per week." : "One bar per day."}
        </p>
        {anyCalls ? (
          <div className={`mt-4 ${isPhone ? "[&_*:focus]:outline-none" : ""}`}>
            <ResponsiveContainer width="100%" height={isPhone ? 180 : 200}>
              <BarChart data={shareRows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barCategoryGap="20%">
                <XAxis
                  dataKey="date"
                  tick={<AxisTick rows={shareRows} />}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 50, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 10, fill: "var(--chart-muted)" }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip
                  cursor={{ fill: "var(--chart-cursor)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as ShareRow | undefined;
                    if (!row) return null;
                    return (
                      <div className="ui-tooltip rounded-lg px-3 py-2 text-xs shadow-sm">
                        <p className="mb-1 font-semibold">{fmtBucket(row)}</p>
                        <p>
                          {row.sharePct === null
                            ? "No client calls"
                            : `${Math.round(row.sharePct)}% of ${row.incoming} answered`}
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="sharePct" fill="var(--chart-series-2)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-slate-400">No client calls in the last 90 days</p>
        )}
      </div>
    </>
  );
}

function Legend({ color, label, dashed, dotted }: { color: string; label: string; dashed?: boolean; dotted?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="18" height="4" className="shrink-0" aria-hidden="true">
        <line
          x1="0"
          y1="2"
          x2="18"
          y2="2"
          stroke={color}
          strokeWidth={dashed || dotted ? 1.5 : 2}
          strokeDasharray={dashed ? "4 3" : dotted ? "2 4" : undefined}
        />
      </svg>
      {label}
    </span>
  );
}

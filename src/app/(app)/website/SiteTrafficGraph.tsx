"use client";

import { useSyncExternalStore } from "react";
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
import {
  MOBILE_MAX_DAILY_BARS,
  fmtMobileTick,
  mobileTickVisible,
  toBuckets,
  toWeeklyBuckets,
  type TrafficBucket,
} from "./traffic-chart-mobile";

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
  { key: "band1", color: goalColors(0).bar },
  { key: "band2", color: goalColors(25).bar },
  { key: "band3", color: goalColors(50).bar },
  { key: "band4", color: goalColors(75).bar },
  { key: "band5", color: goalColors(100).bar },
];

// Tailwind's `sm` breakpoint: below 640 px the chart switches to its phone layout.
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

function fmtWeekRange(bucket: TrafficBucket) {
  const fmt = (v: string) =>
    new Date(`${v}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(bucket.date)} – ${fmt(bucket.endDate)}`;
}

function MobileTick({
  x,
  y,
  index,
  buckets,
  mode,
}: {
  x?: number;
  y?: number;
  index?: number;
  buckets: TrafficBucket[];
  mode: "daily" | "weekly" | "hourly";
}) {
  const i = index ?? -1;
  const bucket = buckets[i];
  if (!bucket || !mobileTickVisible(bucket, i, buckets.length, mode)) return null;
  return (
    <text
      x={x}
      y={y}
      dy={12}
      textAnchor={i === buckets.length - 1 ? "end" : "middle"} // keep the newest label inside the card
      fill="var(--text-secondary)" fontSize={11}>
      {fmtMobileTick(bucket, i, buckets.length, mode)}
    </text>
  );
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
  const isPhone = useIsPhone();
  const weekly = isPhone && granularity === "daily" && rows.length > MOBILE_MAX_DAILY_BARS;
  const mobileMode = weekly ? "weekly" : granularity;
  const buckets = weekly ? toWeeklyBuckets(rows) : toBuckets(rows);
  const total = rows.reduce((s, r) => s + r.current, 0);
  const prevTotal = rows.reduce((s, r) => s + r.previous, 0);
  const pctChange = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
  const isUp = pctChange !== null && pctChange >= 0;
  const targetPerBucket = rows.length > 0 && goal > 0 ? goal / rows.length : 0;
  const perDay = rows.length > 0 && goal > 0 ? goal / rows.length : 0;
  const bucketLabel = weekly ? "week" : granularity === "daily" ? "day" : "hour";
  const paceLabel = granularity === "daily" ? "daily" : "hourly";
  const chartTitle = granularity === "daily" ? "Daily engaged sessions" : "Hourly engaged sessions";
  const chartRows = buckets.map((bucket) => {
    const target = weekly ? perDay * bucket.days : targetPerBucket;
    return { ...bucket, target, ...goalSegments(bucket.current, target) };
  });
  const footerTarget = weekly ? perDay * 7 : targetPerBucket;

  function pacePct(value: number, target: number) {
    return target > 0 ? (value / target) * 100 : 0;
  }

  return (
    <div className="brand-swipe__card mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{chartTitle}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
            {total.toLocaleString("en-US")} total<span className="hidden sm:inline"> — {label.toLowerCase()}</span>
          </p>
          {pctChange !== null ? (
            <p className={`mt-0.5 text-xs font-medium ${isUp ? "text-emerald-600" : "text-amber-600"}`}>
              <span className="text-slate-500 sm:hidden">{label} · </span>
              {isUp ? "+" : ""}{pctChange.toFixed(1)}% vs. prev. period
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-400">
              <span className="sm:hidden">{label} · </span>No comparison data
            </p>
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

      {/* Phones: a tap focuses the chart; hide the focus box it would draw. */}
      <div className={isPhone ? "[&_*:focus]:outline-none" : undefined}>
        <ResponsiveContainer width="100%" height={isPhone ? 220 : 240}>
          <ComposedChart
            data={chartRows}
            margin={isPhone ? { top: 16, right: 4, left: 0, bottom: 4 } : { top: 24, right: 4, left: 8, bottom: 36 }}
            barCategoryGap={isPhone ? "20%" : "25%"}
          >
            <XAxis
              dataKey="date"
              tick={isPhone ? <MobileTick buckets={buckets} mode={mobileMode} /> : <DateTick granularity={granularity} />}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <YAxis
              tickFormatter={formatK}
              tick={{ fontSize: 10, fill: "var(--chart-muted)" }}
              tickLine={false}
              axisLine={false}
              width={isPhone ? 28 : 36}
            allowDecimals={!isPhone}
            />
            <Tooltip
              content={({ active, payload, label: lbl }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as (TrafficBucket & { target: number }) | undefined;
                const currentValue = Number(row?.current ?? 0);
                const currentPace = pacePct(currentValue, row?.target ?? targetPerBucket);
                return (
                  <div className="ui-tooltip rounded-lg px-3 py-2 text-xs shadow-sm">
                    <p className="mb-1 font-semibold">
                      {weekly && row ? fmtWeekRange(row) : fmtTooltipDate(String(lbl), granularity)}
                    </p>
                    <p>{currentValue.toLocaleString("en-US")} engaged sessions</p>
                    <p className="opacity-70">prev. {Number(row?.previous ?? 0).toLocaleString("en-US")}</p>
                    <p className="mt-1 font-semibold">
                      {Math.round(currentPace)}% of {weekly ? "weekly" : paceLabel} pace
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
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Each bar is measured against {footerTarget.toLocaleString("en-US", { maximumFractionDigits: 1 })} engaged sessions per {bucketLabel}
        {" "}and progresses through five theme-derived pace bands.
      </p>
    </div>
  );
}

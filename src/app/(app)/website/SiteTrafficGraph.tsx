"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type TrafficComparisonRow = {
  date: string; // "YYYY-MM-DD" for daily, "YYYY-MM-DDTHH:00:00" for hourly
  current: number;
  previous: number;
};

type Props = {
  rows: TrafficComparisonRow[];
  barColor: string;
  label: string;
  granularity: "daily" | "hourly";
};

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

function tickInterval(rows: number, granularity: "daily" | "hourly") {
  if (granularity === "hourly") {
    return rows <= 24 ? 5 : 11; // every 6h or every 12h
  }
  if (rows <= 7) return 0;
  if (rows <= 30) return 3;
  return 9;
}

export function SiteTrafficGraph({ rows, barColor, label, granularity }: Props) {
  const total = rows.reduce((s, r) => s + r.current, 0);
  const prevTotal = rows.reduce((s, r) => s + r.previous, 0);
  const pctChange = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
  const isUp = pctChange !== null && pctChange >= 0;

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Active users — {label}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
            {total.toLocaleString("en-US")}
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
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: barColor }} />
            Current
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="18" height="4" className="shrink-0">
              <line x1="0" y1="2" x2="18" y2="2" stroke="var(--chart-muted)" strokeWidth="1.5" strokeDasharray="4 3" />
            </svg>
            Previous
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={rows} margin={{ top: 4, right: 4, left: 8, bottom: 4 }} barCategoryGap="25%">
          <XAxis
            dataKey="date"
            tickFormatter={(v) => fmtAxisTick(String(v), granularity)}
            tick={{ fontSize: 10, fill: "var(--chart-muted)" }}
            tickLine={false}
            axisLine={false}
            interval={tickInterval(rows.length, granularity)}
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
              const cur = payload.find((p) => p.dataKey === "current");
              const prev = payload.find((p) => p.dataKey === "previous");
              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                  <p className="mb-1 font-semibold text-slate-700">{fmtTooltipDate(String(lbl), granularity)}</p>
                  <p className="text-slate-900">{Number(cur?.value ?? 0).toLocaleString("en-US")} visitors</p>
                  <p className="text-slate-400">prev. {Number(prev?.value ?? 0).toLocaleString("en-US")}</p>
                </div>
              );
            }}
            cursor={{ fill: "var(--chart-cursor)" }}
          />
          <Bar dataKey="current" fill={barColor} radius={[3, 3, 0, 0]} />
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
  );
}

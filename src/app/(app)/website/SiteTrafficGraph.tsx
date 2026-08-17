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
  date: string;
  current: number;
  previous: number;
};

type Props = {
  rows: TrafficComparisonRow[];
  barColor: string;
  days: number;
};

function formatK(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function tickInterval(days: number) {
  if (days <= 7) return 0;
  if (days <= 30) return 3;
  return 9;
}

export function SiteTrafficGraph({ rows, barColor, days }: Props) {
  const total = rows.reduce((s, r) => s + r.current, 0);
  const prevTotal = rows.reduce((s, r) => s + r.previous, 0);
  const pctChange = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
  const isUp = pctChange !== null && pctChange >= 0;

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Active users — last {days} days
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
            {total.toLocaleString("en-US")}
          </p>
          {pctChange !== null ? (
            <p className={`mt-0.5 text-xs font-medium ${isUp ? "text-emerald-600" : "text-amber-600"}`}>
              {isUp ? "+" : ""}{pctChange.toFixed(1)}% vs. prev. {days} days
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-400">No comparison data</p>
          )}
        </div>

        <div className="flex items-center gap-5 pb-0.5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: barColor }} />
            Current period
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="18" height="4" className="shrink-0">
              <line x1="0" y1="2" x2="18" y2="2" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />
            </svg>
            Previous period
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={rows} margin={{ top: 4, right: 4, left: 8, bottom: 4 }} barCategoryGap="25%">
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            interval={tickInterval(days)}
          />
          <YAxis
            tickFormatter={formatK}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const cur = payload.find((p) => p.dataKey === "current");
              const prev = payload.find((p) => p.dataKey === "previous");
              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                  <p className="mb-1 font-semibold text-slate-700">{fmtDate(String(label))}</p>
                  <p className="text-slate-900">{Number(cur?.value ?? 0).toLocaleString("en-US")} visitors</p>
                  <p className="text-slate-400">prev. {Number(prev?.value ?? 0).toLocaleString("en-US")}</p>
                </div>
              );
            }}
            cursor={{ fill: "#f8fafc" }}
          />
          <Bar dataKey="current" fill={barColor} radius={[3, 3, 0, 0]} />
          <Line
            dataKey="previous"
            stroke="#94a3b8"
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

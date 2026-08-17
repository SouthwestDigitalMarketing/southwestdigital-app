"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

type Props = {
  rows: { date: string; views: number }[];
  monthlyGoal: number;
  barColor: string;
};

function formatK(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function XTick({
  x,
  y,
  payload,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value: string };
}) {
  const dateStr = payload?.value ?? "";
  const d = new Date(dateStr + "T00:00:00");
  const isMonday = d.getDay() === 1;
  const label = isMonday
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : String(d.getDate());

  return (
    <g transform={`translate(${Number(x ?? 0)},${Number(y ?? 0)})`}>
      <text
        x={0}
        y={0}
        dy={11}
        textAnchor="middle"
        fill={isMonday ? "#475569" : "#cbd5e1"}
        fontSize={isMonday ? 9.5 : 9}
        fontWeight={isMonday ? 600 : 400}
      >
        {label}
      </text>
    </g>
  );
}

export function YouTubeViewsGraph({ rows, monthlyGoal, barColor }: Props) {
  const totalViews = rows.reduce((s, r) => s + r.views, 0);
  const pct = Math.min(100, Math.round((totalViews / monthlyGoal) * 100));
  const dailyAvgTarget = monthlyGoal / 30;
  const goalColor = pct >= 100 ? "#6b8e23" : pct >= 60 ? "#f59e0b" : "#cc0000";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            YouTube views — last 30 days
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
            {totalViews.toLocaleString("en-US")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            of {monthlyGoal.toLocaleString("en-US")} monthly goal
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-2xl font-bold tabular-nums" style={{ color: goalColor }}>
            {pct}%
          </span>
          <p className="text-xs text-slate-400">of goal</p>
        </div>
      </div>

      <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: goalColor }}
        />
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No data available</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={rows} margin={{ top: 4, right: 4, left: 8, bottom: 4 }} barCategoryGap="20%">
            <XAxis dataKey="date" tick={XTick as never} tickLine={false} axisLine={false} interval={0} />
            <YAxis
              tickFormatter={formatK}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              width={40}
              label={{
                value: "Views",
                angle: -90,
                position: "insideLeft",
                offset: 12,
                style: { fontSize: 10, fill: "#94a3b8", textAnchor: "middle" },
              }}
            />
            <Tooltip
              formatter={(v) => [Number(v).toLocaleString("en-US"), "Views"]}
              labelFormatter={(label) => {
                const d = new Date(String(label) + "T00:00:00");
                return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
              cursor={{ fill: "#f1f5f9" }}
            />
            <ReferenceLine
              y={dailyAvgTarget}
              stroke="#94a3b8"
              strokeDasharray="4 3"
              label={{ value: "daily target", position: "insideTopRight", fontSize: 9, fill: "#94a3b8" }}
            />
            <Bar dataKey="views" fill={barColor} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { DailyViewRow } from "@/lib/youtube/analytics";

function formatK(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function YouTubeTrendChart({ rows, barColor }: { rows: DailyViewRow[]; barColor: string }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No data for this period.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={rows} margin={{ top: 8, right: 4, left: 4, bottom: 4 }} barCategoryGap="25%">
        <XAxis
          dataKey="date"
          tickFormatter={(v) =>
            new Date(String(v) + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          }
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          interval={6}
        />
        <YAxis
          tickFormatter={formatK}
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip
          formatter={(v) => [Number(v).toLocaleString("en-US"), "Views"]}
          labelFormatter={(label) =>
            new Date(String(label) + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })
          }
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
          cursor={{ fill: "#f8fafc" }}
        />
        <Bar dataKey="views" fill={barColor} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

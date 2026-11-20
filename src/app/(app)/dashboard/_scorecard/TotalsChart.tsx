"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { TotalFigure } from "@/lib/scorecard/totals";
import { formatMonth } from "./format";

type Months = TotalFigure["months"];
type MetricKey = "transactions" | "reports";

const METRICS: { key: MetricKey; label: string; noun: string; color: string }[] = [
  { key: "transactions", label: "Transactions", noun: "transactions recorded", color: "var(--chart-series-1)" },
  { key: "reports", label: "Reports", noun: "reports issued", color: "var(--chart-series-2)" },
];

/** Bars shown; older months still count in the totals above. */
export const CHART_MONTHS = 24;

function shortMonth(month: string) {
  const [y, m] = month.split("-");
  const name = new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short" });
  return m === "01" ? `${name} ${y.slice(2)}` : name;
}

/** Month-by-month bars for the big numbers, last CHART_MONTHS months. */
export function TotalsChart({ transactions, reports }: { transactions: Months; reports: Months }) {
  const [metric, setMetric] = useState<MetricKey>("transactions");
  const all = metric === "transactions" ? transactions : reports;
  const rows = all.slice(-CHART_MONTHS);
  const { noun, color } = METRICS.find((m) => m.key === metric)!;
  if (transactions.length === 0 && reports.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 sm:mt-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Per month</p>
          <p className="mt-1 text-xs text-slate-500">
            {rows.length < all.length ? `Last ${rows.length} months of ${noun}.` : `${noun[0].toUpperCase()}${noun.slice(1)}, by month.`}
          </p>
        </div>
        <div className="flex gap-1 self-start rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="Measure">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={metric === m.key}
              onClick={() => setMetric(m.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                metric === m.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">Not counted yet</p>
      ) : (
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barCategoryGap="20%">
              <XAxis
                dataKey="month"
                tickFormatter={shortMonth}
                tick={{ fontSize: 10, fill: "var(--chart-muted)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={12}
              />
              <YAxis
                allowDecimals={false}
                tickFormatter={(v: number) => v.toLocaleString("en-US")}
                tick={{ fontSize: 10, fill: "var(--chart-muted)" }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                cursor={{ fill: "var(--chart-cursor)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as Months[number] | undefined;
                  if (!row) return null;
                  return (
                    <div className="ui-tooltip rounded-lg px-3 py-2 text-xs shadow-sm">
                      <p className="mb-1 font-semibold">{formatMonth(row.month)}</p>
                      <p>
                        {row.value.toLocaleString("en-US")} {noun}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

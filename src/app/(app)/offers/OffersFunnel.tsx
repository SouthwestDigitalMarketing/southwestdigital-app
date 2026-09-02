"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const STEPS = [
  { key: "sent", label: "Sent", color: "var(--brand-dark, var(--brand-light))" },
  { key: "openedEmail", label: "Opened email", color: "#2563eb" },
  { key: "openedProposal", label: "Opened proposal", color: "var(--brand-accent, #d79b3b)" },
  { key: "continued", label: "Continued from cover", color: "#7c3aed" },
  { key: "selected", label: "Selected a package", color: "#db2777" },
  { key: "agreement", label: "Read agreement", color: "#ea580c" },
  { key: "details", label: "Entered details", color: "#ca8a04" },
  { key: "confirmed", label: "Confirmed", color: "#65a30d" },
  { key: "signed", label: "Signed", color: "#0d9488" },
  { key: "paymentStarted", label: "Started payment", color: "#0284c7" },
  { key: "paid", label: "Payment cleared", color: "#059669" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const PERIODS = [
  { value: "today", label: "Today", days: 1, hourly: true, hours: 24, goal: 3 },
  { value: "yday", label: "Yesterday", days: 1, hourly: true, hours: 24, goal: 3 },
  { value: "48h", label: "48 hours", days: 2, hourly: true, hours: 48, goal: 5 },
  { value: "7d", label: "7 days", days: 7, hourly: false, hours: 0, goal: 12 },
  { value: "30d", label: "30 days", days: 30, hourly: false, hours: 0, goal: 50 },
  { value: "90d", label: "90 days", days: 90, hourly: false, hours: 0, goal: 150 },
] as const;

type DayRow = { date: string } & Record<StepKey, number>;

const CHART_HEIGHT_PX = 96;

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addHours(value: Date, hours: number) {
  return new Date(value.getTime() + hours * 3600000);
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDayKey(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function toHourKey(value: Date) {
  return `${toDayKey(value)}T${pad(value.getHours())}:00:00`;
}

function formatDay(value: Date) {
  return value.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function rangeLabel(period: (typeof PERIODS)[number]) {
  const today = startOfLocalDay(new Date());
  if (period.value === "today") return formatDay(today);
  if (period.value === "yday") return formatDay(addDays(today, -1));
  return `${formatDay(addDays(today, -(period.days - 1)))} – ${formatDay(today)}`;
}

function noise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function emptySteps(): Record<StepKey, number> {
  return {
    sent: 0,
    openedEmail: 0,
    openedProposal: 0,
    continued: 0,
    selected: 0,
    agreement: 0,
    details: 0,
    confirmed: 0,
    signed: 0,
    paymentStarted: 0,
    paid: 0,
  };
}

function countsForSeed(seed: number, dailyGoal: number, quiet: boolean): Record<StepKey, number> {
  const base = Math.max(0, dailyGoal * (quiet ? 0.35 : 1) * (0.5 + noise(seed) * 0.95));
  const counts = emptySteps();
  STEPS.forEach((step, index) => {
    const drop = 0.78 ** index;
    counts[step.key] = Math.max(0, Math.round(base * drop * (0.55 + noise(seed + index * 19) * 0.7)));
  });
  return counts;
}

function buildDailyRows(period: (typeof PERIODS)[number]): DayRow[] {
  const now = new Date();
  const today = startOfLocalDay(now);
  const rows: DayRow[] = [];

  if (period.hourly) {
    const end = period.value === "yday" ? today : now;
    const start = addHours(end, -(period.hours - 1));
    const startHour = new Date(start.getFullYear(), start.getMonth(), start.getDate(), start.getHours());
    for (let index = 0; index < period.hours; index += 1) {
      const point = addHours(startHour, index);
      rows.push({
        date: toHourKey(point),
        ...countsForSeed(point.getTime() / 3600000, period.goal / period.hours, point.getHours() < 8),
      });
    }
    return rows;
  }

  for (let index = period.days - 1; index >= 0; index -= 1) {
    const day = addDays(today, -index);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    rows.push({
      date: toDayKey(day),
      ...countsForSeed(day.getTime() / 86400000, period.goal / period.days, weekend),
    });
  }
  return rows;
}

function formatK(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function DateTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  if (!payload?.value) return null;
  const raw = String(payload.value);
  const isHour = raw.includes("T");
  const date = new Date(isHour ? raw : `${raw}T00:00:00`);
  const isMonday = !isHour && date.getDay() === 1;
  const label = isHour
    ? date.getHours() === 0
      ? formatDay(date)
      : date.toLocaleTimeString("en-US", { hour: "numeric" }).replace(":00", "")
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={4}
        textAnchor="end"
        fill={isMonday ? "var(--text-secondary)" : "var(--chart-muted)"}
        fontSize={10}
        fontWeight={isMonday ? 700 : 400}
        transform="rotate(-45)"
      >
        {label}
      </text>
    </g>
  );
}

function tickInterval(count: number, hourly: boolean) {
  if (hourly) return count <= 24 ? 3 : 5;
  if (count <= 31) return 0;
  return 2;
}

function tooltipDate(value: string) {
  if (value.includes("T")) {
    const date = new Date(value);
    return `${date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ${date
      .toLocaleTimeString("en-US", { hour: "numeric" })
      .replace(":00", "")}`;
  }
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function PeriodChips({
  period,
  onChange,
}: {
  period: (typeof PERIODS)[number]["value"];
  onChange: (value: (typeof PERIODS)[number]["value"]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
      {PERIODS.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`rounded-md px-3 py-1.5 text-base font-medium transition-colors ${
            period === item.value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function StepLegend() {
  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-base text-slate-500">
      {STEPS.map((step) => (
        <span key={step.key} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: step.color }} />
          {step.label}
        </span>
      ))}
    </div>
  );
}

export function OffersFunnel() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["value"]>("30d");
  const selected = PERIODS.find((item) => item.value === period) ?? PERIODS[4];
  const dailyRows = useMemo(() => buildDailyRows(selected), [selected]);
  const funnelCounts = useMemo(
    () => STEPS.map((step) => dailyRows.reduce((sum, row) => sum + row[step.key], 0)),
    [dailyRows],
  );
  const sentTotal = funnelCounts[0] ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodChips period={period} onChange={setPeriod} />
        <p className="text-base text-slate-500">Sample data · {rangeLabel(selected)}</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conversion</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {sentTotal.toLocaleString("en-US")} sent of {selected.goal} goal
          </p>
          <div className="mt-3 overflow-x-auto">
            <div className="flex min-w-[56rem] items-end gap-2">
              {STEPS.map((step, index) => {
                const count = funnelCounts[index] ?? 0;
                const previous = index === 0 ? selected.goal : (funnelCounts[index - 1] ?? 0);
                const conversion = previous > 0 ? Math.round((count / previous) * 100) : 0;
                const heightPct = selected.goal > 0 ? Math.max((count / selected.goal) * 100, count > 0 ? 2 : 0) : 0;
                const isSent = index === 0;
                return (
                  <div
                    key={step.key}
                    className="flex min-w-0 flex-1 flex-col items-center"
                    title={isSent ? `${count} sent of ${selected.goal} goal` : `${count} · ${conversion}% of previous step`}
                  >
                    <p className="mb-1 text-sm font-semibold tabular-nums text-slate-900">{count}</p>
                    <div className="relative w-full max-w-16" style={{ height: CHART_HEIGHT_PX }}>
                      {isSent ? <div className="offer-funnel-goal absolute inset-0 rounded-t-md" /> : null}
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-t-md"
                        style={{ height: `${heightPct}%`, backgroundColor: step.color }}
                      />
                    </div>
                    <p className="mt-2 text-center text-xs leading-4 text-slate-500">{step.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Daily activity</p>
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyRows} margin={{ top: 8, right: 8, left: 4, bottom: 28 }} barCategoryGap="25%">
              <XAxis
                dataKey="date"
                tick={<DateTick />}
                tickLine={false}
                axisLine={false}
                interval={tickInterval(dailyRows.length, selected.hourly)}
              />
              <YAxis
                tickFormatter={formatK}
                tick={{ fontSize: 10, fill: "var(--chart-muted)" }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip
                cursor={{ fill: "var(--chart-cursor)" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const entries = payload.filter((entry) => Number(entry.value) > 0);
                  if (!entries.length) return null;
                  return (
                    <div className="ui-tooltip rounded-lg px-3 py-2 text-base shadow-sm">
                      <p className="mb-1.5 font-semibold">{tooltipDate(String(label))}</p>
                      {entries.map((entry) => (
                        <p key={String(entry.dataKey)} className="opacity-80">
                          {STEPS.find((step) => step.key === entry.dataKey)?.label}: {Number(entry.value ?? 0)}
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              {STEPS.map((step, index) => (
                <Bar
                  key={step.key}
                  dataKey={step.key}
                  stackId="steps"
                  fill={step.color}
                  radius={index === STEPS.length - 1 ? [3, 3, 0, 0] : undefined}
                />
              ))}
            </BarChart>
            </ResponsiveContainer>
          </div>
          <StepLegend />
        </div>
      </section>
    </div>
  );
}

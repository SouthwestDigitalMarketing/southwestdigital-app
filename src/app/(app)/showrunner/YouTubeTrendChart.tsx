"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer } from "recharts";
import { TOP_N, VIDEO_COLORS, OTHER_COLOR } from "./constants";

export { TOP_N, VIDEO_COLORS, OTHER_COLOR };

export type StackedDayRow = Record<string, string | number>;

export type VideoSegment = {
  videoId: string;
  title: string;
  color: string;
};

function formatK(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function DateTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  if (!payload?.value) return null;
  const date = new Date(String(payload.value) + "T00:00:00");
  const isMonday = date.getDay() === 1;
  const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
        {label}
      </text>
    </g>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function makeTooltip(segments: VideoSegment[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function TooltipContent({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const dateLabel = new Date(String(label) + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries = (payload as any[]).filter((p: any) => Number(p.value) > 0);
    if (!entries.length) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total = entries.reduce((s: number, p: any) => s + Number(p.value), 0);
    return (
      <div className="ui-tooltip rounded-lg px-3 py-2 text-xs shadow-sm">
        <p className="mb-1.5 font-semibold">{dateLabel}</p>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {entries.map((entry: any) => {
          const seg = segments.find((s: VideoSegment) => s.videoId === String(entry.dataKey));
          return (
            <div key={String(entry.dataKey)} className="flex items-center gap-1.5 py-0.5">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: seg?.color ?? "var(--chart-other)" }} />
              <span className="flex-1 opacity-80">{truncate(seg?.title ?? String(entry.dataKey), 32)}</span>
              <span className="ml-3 font-medium">{Number(entry.value).toLocaleString("en-US")}</span>
            </div>
          );
        })}
        {entries.length > 1 && (
          <div className="mt-1 border-t border-white/25 pt-1 text-right font-semibold">
            {total.toLocaleString("en-US")} total
          </div>
        )}
      </div>
    );
  };
}

export function YouTubeTrendChart({
  stackedRows,
  segments,
}: {
  stackedRows: StackedDayRow[];
  segments: VideoSegment[];
}) {
  if (stackedRows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No data for this period.</p>;
  }

  const chartRows = stackedRows.map((row) => ({
    ...row,
    dailyTotal: segments.reduce((total, segment) => total + Number(row[segment.videoId] ?? 0), 0),
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={216}>
        <BarChart data={chartRows} margin={{ top: 24, right: 4, left: 4, bottom: 28 }} barCategoryGap="25%">
          <XAxis
            dataKey="date"
            tick={<DateTick />}
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
          <Tooltip content={makeTooltip(segments)} cursor={{ fill: "var(--chart-cursor)" }} />
          {segments.map((seg, i) => (
            <Bar
              key={seg.videoId}
              dataKey={seg.videoId}
              stackId="a"
              fill={seg.color}
              radius={i === segments.length - 1 ? [3, 3, 0, 0] : undefined}
            >
              {i === segments.length - 1 ? (
                <LabelList
                  dataKey="dailyTotal"
                  position="top"
                  fill="var(--text-secondary)"
                  fontSize={9}
                />
              ) : null}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>

    </div>
  );
}

"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
        <p className="mb-1.5 font-semibold text-slate-700">{dateLabel}</p>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {entries.map((entry: any) => {
          const seg = segments.find((s: VideoSegment) => s.videoId === String(entry.dataKey));
          return (
            <div key={String(entry.dataKey)} className="flex items-center gap-1.5 py-0.5">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: seg?.color ?? "#94a3b8" }} />
              <span className="flex-1 text-slate-600">{truncate(seg?.title ?? String(entry.dataKey), 32)}</span>
              <span className="ml-3 font-medium text-slate-900">{Number(entry.value).toLocaleString("en-US")}</span>
            </div>
          );
        })}
        {entries.length > 1 && (
          <div className="mt-1 border-t border-slate-100 pt-1 text-right font-semibold text-slate-700">
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

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={stackedRows} margin={{ top: 8, right: 4, left: 4, bottom: 4 }} barCategoryGap="25%">
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
          <Tooltip content={makeTooltip(segments)} cursor={{ fill: "#f8fafc" }} />
          {segments.map((seg, i) => (
            <Bar
              key={seg.videoId}
              dataKey={seg.videoId}
              stackId="a"
              fill={seg.color}
              radius={i === segments.length - 1 ? [3, 3, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((seg) => (
          <div key={seg.videoId} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: seg.color }} />
            {truncate(seg.title, 36)}
          </div>
        ))}
      </div>
    </div>
  );
}

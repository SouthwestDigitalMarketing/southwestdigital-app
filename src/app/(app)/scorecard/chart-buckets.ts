// Turns the 90-day daily series into chart rows. Phones get weekly buckets
// (same idea as website/traffic-chart-mobile.ts: counted back from the newest
// day, so only the oldest week can be short).
import type { DailyPoint } from "@/lib/scorecard/types";

// More daily rows than this and a phone shows weekly points instead (90 -> 13).
export const PHONE_MAX_DAILY_POINTS = 31;

export type TimeRow = {
  date: string; // first day in the bucket
  endDate: string; // last day; same as date for daily rows
  days: number;
  count: number;
  /** Hours, null when nothing was answered in the bucket. */
  medianHours: number | null;
  p90Hours: number | null;
};

export type ShareRow = {
  date: string;
  endDate: string;
  days: number;
  incoming: number;
  /** 0..100, null when no calls came in. */
  sharePct: number | null;
};

const toHours = (seconds: number | null) => (seconds === null ? null : seconds / 3600);

export function dailyTimeRows(points: DailyPoint[]): TimeRow[] {
  return points.map((p) => ({
    date: p.date,
    endDate: p.date,
    days: 1,
    count: p.count,
    medianHours: toHours(p.medianSeconds),
    p90Hours: toHours(p.p90Seconds),
  }));
}

/**
 * Middle value of the daily values, each day weighted by its count. A week's
 * true median needs the raw spans, which the page does not have; this is the
 * honest stand-in and the chart says so.
 */
export function weightedMedian(values: { value: number; weight: number }[]): number | null {
  const usable = values.filter((v) => v.weight > 0).sort((a, b) => a.value - b.value);
  const total = usable.reduce((s, v) => s + v.weight, 0);
  if (total === 0) return null;
  let seen = 0;
  for (const v of usable) {
    seen += v.weight;
    if (seen >= total / 2) return v.value;
  }
  return usable[usable.length - 1].value;
}

function chunkWeeks<T>(rows: T[]): T[][] {
  const weeks: T[][] = [];
  for (let end = rows.length; end > 0; end -= 7) {
    weeks.unshift(rows.slice(Math.max(0, end - 7), end));
  }
  return weeks;
}

export function weeklyTimeRows(points: DailyPoint[]): TimeRow[] {
  return chunkWeeks(points).map((week) => {
    const pick = (key: "medianSeconds" | "p90Seconds") =>
      toHours(
        weightedMedian(
          week.flatMap((p) => (p[key] === null ? [] : [{ value: p[key] as number, weight: p.count }])),
        ),
      );
    return {
      date: week[0].date,
      endDate: week[week.length - 1].date,
      days: week.length,
      count: week.reduce((s, p) => s + p.count, 0),
      medianHours: pick("medianSeconds"),
      p90Hours: pick("p90Seconds"),
    };
  });
}

type SharePoint = { date: string; share: number | null; incoming: number };

export function dailyShareRows(points: SharePoint[]): ShareRow[] {
  return points.map((p) => ({
    date: p.date,
    endDate: p.date,
    days: 1,
    incoming: p.incoming,
    sharePct: p.share === null || p.incoming === 0 ? null : p.share * 100,
  }));
}

// Exact for weeks: answered calls per day are share x incoming.
export function weeklyShareRows(points: SharePoint[]): ShareRow[] {
  return chunkWeeks(points).map((week) => {
    const incoming = week.reduce((s, p) => s + p.incoming, 0);
    const answered = week.reduce((s, p) => s + (p.share ?? 0) * p.incoming, 0);
    return {
      date: week[0].date,
      endDate: week[week.length - 1].date,
      days: week.length,
      incoming,
      sharePct: incoming === 0 ? null : (answered / incoming) * 100,
    };
  });
}

// Axis steps a person can read: 10 min, 15 min, 30 min, 1 h ... 1 week.
const HOUR_STEPS = [1 / 6, 0.25, 0.5, 1, 2, 4, 8, 12, 24, 48, 72, 168];

/** Up to five evenly spaced y-axis ticks (hours) from 0 that cover maxHours. */
export function hourTicks(maxHours: number): number[] {
  const max = Math.max(maxHours, 1 / 6);
  const step = HOUR_STEPS.find((s) => Math.ceil(max / s) <= 4) ?? Math.ceil(max / 4 / 168) * 168;
  const n = Math.max(1, Math.ceil(max / step));
  return Array.from({ length: n + 1 }, (_, i) => i * step);
}

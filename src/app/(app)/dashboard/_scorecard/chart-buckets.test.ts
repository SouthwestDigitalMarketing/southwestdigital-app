import { describe, expect, it } from "vitest";
import type { DailyPoint } from "@/lib/scorecard/types";
import {
  dailyShareRows,
  dailyTimeRows,
  weeklyShareRows,
  weeklyTimeRows,
  hourTicks,
  weightedMedian,
} from "./chart-buckets";

function days(start: string, n: number, make: (i: number) => Omit<DailyPoint, "date">): DailyPoint[] {
  const base = new Date(`${start}T00:00:00Z`).getTime();
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(base + i * 86400000).toISOString().slice(0, 10),
    ...make(i),
  }));
}

describe("weightedMedian", () => {
  it("weights each value by its count", () => {
    expect(weightedMedian([{ value: 10, weight: 1 }, { value: 100, weight: 5 }])).toBe(100);
    expect(weightedMedian([{ value: 10, weight: 3 }, { value: 100, weight: 1 }])).toBe(10);
  });

  it("is null with no weight", () => {
    expect(weightedMedian([])).toBeNull();
    expect(weightedMedian([{ value: 5, weight: 0 }])).toBeNull();
  });
});

describe("time rows", () => {
  it("converts daily seconds to hours and keeps gaps as null", () => {
    const rows = dailyTimeRows(days("2026-11-01", 2, (i) => ({
      count: i,
      medianSeconds: i ? 5400 : null,
      p90Seconds: i ? 7200 : null,
    })));
    expect(rows[0]).toMatchObject({ medianHours: null, p90Hours: null, count: 0 });
    expect(rows[1]).toMatchObject({ medianHours: 1.5, p90Hours: 2, days: 1 });
  });

  it("makes 13 weeks from 90 days, newest full, oldest short", () => {
    const rows = weeklyTimeRows(days("2026-08-23", 90, () => ({ count: 2, medianSeconds: 3600, p90Seconds: 7200 })));
    expect(rows).toHaveLength(13);
    expect(rows[0]).toMatchObject({ date: "2026-08-23", endDate: "2026-08-28", days: 6, count: 12 });
    expect(rows[12]).toMatchObject({ endDate: "2026-11-20", days: 7, count: 14, medianHours: 1, p90Hours: 2 });
  });

  it("gives an empty week no time", () => {
    const rows = weeklyTimeRows(days("2026-11-14", 7, () => ({ count: 0, medianSeconds: null, p90Seconds: null })));
    expect(rows[0]).toMatchObject({ count: 0, medianHours: null, p90Hours: null });
  });
});

describe("share rows", () => {
  const points = [
    { date: "2026-11-14", share: 1, incoming: 2 },
    { date: "2026-11-15", share: null, incoming: 0 },
    { date: "2026-11-16", share: 0.5, incoming: 4 },
  ];

  it("keeps days with no calls empty", () => {
    expect(dailyShareRows(points).map((r) => r.sharePct)).toEqual([100, null, 50]);
  });

  it("adds weeks up from answered calls, not by averaging shares", () => {
    const [week] = weeklyShareRows(points);
    expect(week.incoming).toBe(6);
    expect(week.sharePct).toBeCloseTo((4 / 6) * 100);
  });
});

describe("hourTicks", () => {
  it("picks readable steps that cover the top", () => {
    expect(hourTicks(1.4)).toEqual([0, 0.5, 1, 1.5]);
    expect(hourTicks(5.6)).toEqual([0, 2, 4, 6]);
    expect(hourTicks(0.1)).toEqual([0, 1 / 6]);
    expect(hourTicks(30)).toEqual([0, 8, 16, 24, 32]);
  });

  it("never returns a lone zero", () => {
    expect(hourTicks(0)).toEqual([0, 1 / 6]);
  });
});

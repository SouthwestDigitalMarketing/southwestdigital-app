import { describe, expect, it } from "vitest";
import { fmtMobileTick, mobileTickVisible, toBuckets, toWeeklyBuckets } from "./traffic-chart-mobile";

function days(start: string, n: number) {
  const base = new Date(`${start}T00:00:00Z`).getTime();
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(base + i * 86400000).toISOString().slice(0, 10),
    current: 1,
    previous: 2,
  }));
}

describe("toWeeklyBuckets", () => {
  it("makes 13 bars from 90 days, newest week full, oldest short", () => {
    const buckets = toWeeklyBuckets(days("2026-08-22", 90));
    expect(buckets).toHaveLength(13);
    expect(buckets[0]).toMatchObject({ date: "2026-08-22", endDate: "2026-08-27", days: 6, current: 6, previous: 12 });
    expect(buckets[12]).toMatchObject({ date: "2026-11-13", endDate: "2026-11-19", days: 7, current: 7 });
  });

  it("keeps the totals", () => {
    const rows = days("2026-08-22", 90);
    const buckets = toWeeklyBuckets(rows);
    expect(buckets.reduce((s, b) => s + b.current, 0)).toBe(90);
    expect(buckets.reduce((s, b) => s + b.days, 0)).toBe(90);
  });
});

describe("mobileTickVisible", () => {
  it("shows only Mondays in a 30-day view", () => {
    const buckets = toBuckets(days("2026-10-21", 30));
    const shown = buckets.filter((b, i) => mobileTickVisible(b, i, buckets.length, "daily")).map((b) => b.date);
    expect(shown).toEqual(["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16"]);
  });

  it("shows every day in a 7-day view", () => {
    const buckets = toBuckets(days("2026-11-13", 7));
    expect(buckets.every((b, i) => mobileTickVisible(b, i, buckets.length, "daily"))).toBe(true);
  });

  it("shows at most five weekly labels, including the newest week", () => {
    const buckets = toWeeklyBuckets(days("2026-08-22", 90));
    const shown = buckets.map((b, i) => mobileTickVisible(b, i, buckets.length, "weekly"));
    expect(shown.filter(Boolean).length).toBeLessThanOrEqual(5);
    expect(shown[12]).toBe(true);
  });

  it("shows hours every 6 for a day and every 12 for 48 hours", () => {
    const hours = (n: number) =>
      Array.from({ length: n }, (_, h) => ({ date: `2026-11-${18 + Math.floor(h / 24)}T${String(h % 24).padStart(2, "0")}:00:00` }));
    const day = hours(24);
    expect(day.filter((b, i) => mobileTickVisible(b, i, 24, "hourly"))).toHaveLength(4);
    const two = hours(48);
    expect(two.filter((b, i) => mobileTickVisible(b, i, 48, "hourly"))).toHaveLength(4);
  });
});

describe("fmtMobileTick", () => {
  it("labels a 7-day view with the month only on the first bar and the 1st", () => {
    const buckets = toBuckets(days("2026-10-29", 7));
    expect(buckets.map((b, i) => fmtMobileTick(b, i, 7, "daily"))).toEqual(["Oct 29", "30", "31", "Nov 1", "2", "3", "4"]);
  });

  it("labels Mondays with month and day in a 30-day view", () => {
    expect(fmtMobileTick({ date: "2026-11-02" }, 12, 30, "daily")).toBe("Nov 2");
  });

  it("labels hours as 6am / 12pm and midnight as the date in 48 hours", () => {
    expect(fmtMobileTick({ date: "2026-11-18T06:00:00" }, 6, 24, "hourly")).toBe("6am");
    expect(fmtMobileTick({ date: "2026-11-18T12:00:00" }, 12, 24, "hourly")).toBe("12pm");
    expect(fmtMobileTick({ date: "2026-11-19T00:00:00" }, 24, 48, "hourly")).toBe("Nov 19");
  });
});

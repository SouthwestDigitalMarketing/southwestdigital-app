import { describe, expect, it } from "vitest";
import {
  formatAgo,
  formatCalendarDays,
  formatDate,
  formatDuration,
  formatMonth,
  formatShare,
  isStale,
  measureFigures,
  parseRange,
  targetWords,
} from "./format";

describe("formatDuration", () => {
  it("says minutes under an hour", () => {
    expect(formatDuration(5, "business")).toBe("under 1 min");
    expect(formatDuration(240, "business")).toBe("4 min");
    expect(formatDuration(3590, "clock")).toBe("1 h");
  });

  it("says hours with one decimal up to 48 h", () => {
    expect(formatDuration(5400, "business")).toBe("1.5 h");
    expect(formatDuration(7200, "clock")).toBe("2 h");
    expect(formatDuration(47 * 3600, "clock")).toBe("47 h");
  });

  it("keeps business time in hours, never 24-hour days", () => {
    // 7 business days of 9 h is 63 business hours, not "2.6 days".
    expect(formatDuration(63 * 3600, "business")).toBe("63 h");
    expect(formatDuration(2 * 86400, "business")).toBe("48 h");
  });

  it("says 24-hour days for clock time from 48 h", () => {
    expect(formatDuration(2 * 86400, "clock")).toBe("2 days");
    expect(formatDuration(3.5 * 86400, "clock")).toBe("3.5 days");
  });

  it("never goes negative", () => {
    expect(formatDuration(-10, "business")).toBe("under 1 min");
  });
});

describe("formatCalendarDays", () => {
  it("says calendar days with one decimal", () => {
    expect(formatCalendarDays(19 * 86400)).toBe("19 days");
    expect(formatCalendarDays(86400)).toBe("1 day");
    expect(formatCalendarDays(0.5 * 86400)).toBe("0.5 days");
  });
});

describe("measureFigures", () => {
  // A report published 19 calendar days after month end: about 13 weekdays
  // of 9 business hours, 117 business hours.
  const report = {
    medianSeconds: 117 * 3600,
    p90Seconds: 120 * 3600,
    medianClockSeconds: 19 * 86400,
    p90ClockSeconds: 21 * 86400,
  };

  it("leads reports with calendar days from the clock fields", () => {
    expect(measureFigures(report, "clock")).toEqual({ median: "19 days", p90: "21 days", extra: [] });
  });

  it("leads business measures with business hours plus the clock median", () => {
    expect(measureFigures(report, "business")).toEqual({
      median: "117 h",
      p90: "120 h",
      extra: [["Median on the clock", "19 days"]],
    });
  });

  it("is null when nothing was answered", () => {
    const none = { medianSeconds: null, p90Seconds: null, medianClockSeconds: null, p90ClockSeconds: null };
    expect(measureFigures(none, "clock")).toBeNull();
    expect(measureFigures(none, "business")).toBeNull();
  });
});

describe("formatAgo and isStale", () => {
  const now = new Date("2026-11-20T15:00:00Z");

  it("reads like speech", () => {
    expect(formatAgo("2026-11-20T14:59:30Z", now)).toBe("just now");
    expect(formatAgo("2026-11-20T14:56:00Z", now)).toBe("4 min ago");
    expect(formatAgo("2026-11-20T12:30:00Z", now)).toBe("2 h ago");
    expect(formatAgo("2026-11-19T14:00:00Z", now)).toBe("1 day ago");
    expect(formatAgo("2026-11-17T14:00:00Z", now)).toBe("3 days ago");
  });

  it("is stale only after 15 minutes", () => {
    expect(isStale("2026-11-20T14:46:00Z", now)).toBe(false);
    expect(isStale("2026-11-20T14:44:00Z", now)).toBe(true);
    expect(isStale("not a date", now)).toBe(true);
  });
});

describe("parseRange", () => {
  it("defaults to this week", () => {
    expect(parseRange(undefined)).toBe("week");
    expect(parseRange("year")).toBe("week");
    expect(parseRange(["30d", "90d"])).toBe("30d");
    expect(parseRange("today")).toBe("today");
  });
});

describe("targetWords", () => {
  it("puts targets in words", () => {
    expect(targetWords("text", 3600)).toBe("within 1 business hour");
    expect(targetWords("email", 4 * 3600)).toBe("within 4 business hours");
    expect(targetWords("report", 10 * 86400)).toBe("within 10 days of month end");
    expect(targetWords("call", 1800)).toBe("within 30 min of business time");
  });
});

describe("small labels", () => {
  it("formats shares, dates and months", () => {
    expect(formatShare(0.873)).toBe("87%");
    expect(formatShare(null)).toBe("—");
    expect(formatDate("2026-11-19")).toBe("Nov 19, 2026");
    expect(formatMonth("2026-10")).toBe("Oct 2026");
  });
});

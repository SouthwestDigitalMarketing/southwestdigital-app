import { describe, expect, it } from "vitest";
import {
  formatAgo,
  formatDate,
  formatDuration,
  formatMonth,
  formatShare,
  isStale,
  parseRange,
  targetWords,
} from "./format";

describe("formatDuration", () => {
  it("says minutes under an hour", () => {
    expect(formatDuration(5)).toBe("under 1 min");
    expect(formatDuration(240)).toBe("4 min");
    expect(formatDuration(3590)).toBe("1 h");
  });

  it("says hours with one decimal up to 48 h", () => {
    expect(formatDuration(5400)).toBe("1.5 h");
    expect(formatDuration(7200)).toBe("2 h");
    expect(formatDuration(47 * 3600)).toBe("47 h");
  });

  it("says days from 48 h", () => {
    expect(formatDuration(2 * 86400)).toBe("2 days");
    expect(formatDuration(3.5 * 86400)).toBe("3.5 days");
  });

  it("never goes negative", () => {
    expect(formatDuration(-10)).toBe("under 1 min");
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

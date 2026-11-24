import { describe, expect, it } from "vitest";
import { daysBetween, isReportMonth, monthLabel, reportMonths, thisMonth, thisWeek, monthRange, centralMidnight } from "./month";

describe("Showrunner months", () => {
  it("counts this month from the 1st in Central time, with YouTube's 3-day lag", () => {
    const m = thisMonth(new Date("2026-11-24T18:00:00Z"));
    expect(m).toEqual({ month: "2026-11", label: "November 2026", start: "2026-11-01", today: "2026-11-24", analyticsEnd: "2026-11-21" });
  });

  it("has no settled YouTube days in the first days of a month", () => {
    expect(thisMonth(new Date("2026-12-02T18:00:00Z")).analyticsEnd).toBeNull();
    // 11 PM Central on Nov 30 is still November.
    expect(thisMonth(new Date("2026-12-01T05:00:00Z")).month).toBe("2026-11");
  });

  it("lists report months newest first back to the first tracked month", () => {
    expect(reportMonths(new Date("2027-01-10T18:00:00Z"))).toEqual(["2027-01", "2026-12", "2026-11", "2026-10", "2026-09", "2026-08"]);
    expect(isReportMonth("2026-09", new Date("2026-11-24T18:00:00Z"))).toBe(true);
    expect(isReportMonth("2026-12", new Date("2026-11-24T18:00:00Z"))).toBe(false);
    expect(isReportMonth("2026-13", new Date("2026-11-24T18:00:00Z"))).toBe(false);
  });

  it("labels months and walks days", () => {
    expect(monthLabel("2026-08")).toBe("August 2026");
    expect(daysBetween("2026-11-29", "2026-12-01")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"]);
  });

  it("counts this week from Sunday; YouTube settles only from Wednesday", () => {
    expect(thisWeek(new Date("2026-11-24T18:00:00Z"))).toMatchObject({ start: "2026-11-22", today: "2026-11-24", analyticsEnd: null, label: "Week of Nov 22" });
    expect(thisWeek(new Date("2026-11-27T18:00:00Z")).analyticsEnd).toBe("2026-11-24");
    expect(thisWeek(new Date("2026-11-22T18:00:00Z")).start).toBe("2026-11-22");
  });

  it("bounds a report month in Central time, daylight saving included", () => {
    expect(centralMidnight("2026-11-01").toISOString()).toBe("2026-11-01T05:00:00.000Z"); // still CDT
    expect(centralMidnight("2026-12-01").toISOString()).toBe("2026-12-01T06:00:00.000Z");
    const past = monthRange("2026-10", new Date("2026-11-24T18:00:00Z"));
    expect(past).toMatchObject({ start: "2026-10-01", last: "2026-10-31", current: false, analyticsEnd: "2026-10-31" });
    expect(past.to.toISOString()).toBe("2026-11-01T05:00:00.000Z");
    const now = new Date("2026-11-24T18:00:00Z");
    expect(monthRange("2026-11", now)).toMatchObject({ current: true, analyticsEnd: "2026-11-21", to: now });
  });
});

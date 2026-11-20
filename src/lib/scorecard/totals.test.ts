import { describe, expect, it } from "vitest";
import { parseTotalsBody, previousMonth, totalFigure } from "./totals";

const now = new Date("2026-11-20T15:00:00Z");

describe("parseTotalsBody", () => {
  const ok = { brand: "bookkeeping-conroe", metric: "transactions", months: [{ month: "2026-10", value: 823 }] };

  it("accepts a well-formed post", () => {
    expect(parseTotalsBody({ ...ok, note: " 6 companies " }, now)).toEqual({
      brand: "bookkeeping-conroe",
      metric: "transactions",
      months: [{ month: "2026-10", value: 823 }],
      note: "6 companies",
    });
    expect(parseTotalsBody({ ...ok, months: [] }, now)).toMatchObject({ months: [] });
  });

  it("rejects bad shapes with a reason", () => {
    expect(parseTotalsBody(null, now)).toMatch(/object/);
    expect(parseTotalsBody({ ...ok, brand: "" }, now)).toMatch(/brand/);
    expect(parseTotalsBody({ ...ok, metric: "invoices" }, now)).toMatch(/metric/);
    expect(parseTotalsBody({ ...ok, months: "x" }, now)).toMatch(/array/);
    expect(parseTotalsBody({ ...ok, months: [{ month: "2026-13", value: 1 }] }, now)).toMatch(/YYYY-MM/);
    expect(parseTotalsBody({ ...ok, months: [{ month: "2026-12", value: 1 }] }, now)).toMatch(/future/);
    expect(parseTotalsBody({ ...ok, months: [{ month: "2026-10", value: 1.5 }] }, now)).toMatch(/whole number/);
    expect(parseTotalsBody({ ...ok, months: [{ month: "2026-10", value: -1 }] }, now)).toMatch(/whole number/);
    expect(
      parseTotalsBody({ ...ok, months: [{ month: "2026-10", value: 1 }, { month: "2026-10", value: 2 }] }, now),
    ).toMatch(/repeats/);
    expect(parseTotalsBody({ ...ok, note: 5 }, now)).toMatch(/note/);
  });

  it("uses the firm's month, not UTC's", () => {
    // 2026-12-01 03:00 UTC is still Nov 30 in Central time.
    const lateNov = new Date("2026-12-01T03:00:00Z");
    expect(parseTotalsBody({ ...ok, months: [{ month: "2026-12", value: 1 }] }, lateNov)).toMatch(/future/);
  });
});

describe("previousMonth", () => {
  it("wraps the year", () => {
    expect(previousMonth("2026-11")).toBe("2026-10");
    expect(previousMonth("2026-01")).toBe("2025-12");
  });
});

describe("totalFigure", () => {
  it("sums all time, fills gaps with zeros, and picks this and last month", () => {
    const fig = totalFigure(
      [
        { month: "2026-08", value: 10 },
        { month: "2026-10", value: 5 },
        { month: "2026-11", value: 7 },
      ],
      "2026-11",
    );
    expect(fig.allTime).toBe(22);
    expect(fig.thisMonth).toBe(7);
    expect(fig.lastMonth).toBe(5);
    expect(fig.since).toBe("2026-08");
    expect(fig.months.map((m) => m.month)).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(fig.months[1].value).toBe(0);
  });

  it("starts at the first month with a count and runs to this month across a year end", () => {
    const fig = totalFigure(
      [
        { month: "2025-11", value: 0 },
        { month: "2025-12", value: 3 },
      ],
      "2026-02",
    );
    expect(fig.since).toBe("2025-12");
    expect(fig.months.map((m) => m.month)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(fig.thisMonth).toBe(0);
  });

  it("is empty when nothing is counted", () => {
    expect(totalFigure([], "2026-11")).toEqual({ allTime: 0, thisMonth: 0, lastMonth: 0, since: null, months: [] });
  });
});

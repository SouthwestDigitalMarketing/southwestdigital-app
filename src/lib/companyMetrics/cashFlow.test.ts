import { describe, expect, it } from "vitest";
import { freeCashFlow, lastClosedCandidate, monthEnd } from "./cashFlow";

describe("free cash flow", () => {
  it("subtracts expenses, owner draw and tax set-aside once", () => {
    expect(freeCashFlow({ month: "2026-10", incomeUsd: 2400, expensesUsd: 2004.58, ownerDrawUsd: 100, taxSetAsideUsd: 50 })).toBe(245.42);
  });
  it("handles year rollover in Chicago and rejects unverified negative components", () => {
    expect(lastClosedCandidate(new Date("2027-01-01T04:00:00Z"))).toBe("2026-11");
    expect(monthEnd("2026-02")).toBe("2026-02-28");
    expect(() => freeCashFlow({ month: "2026-10", incomeUsd: 1, expensesUsd: 0, ownerDrawUsd: -1, taxSetAsideUsd: 0 })).toThrow();
  });
});

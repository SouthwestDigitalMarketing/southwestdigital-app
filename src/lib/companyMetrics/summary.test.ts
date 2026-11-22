import { describe, expect, it } from "vitest";
import { summarizeCompanyMetrics, type BrandMetrics } from "./summary";

const brand = (slug: string, values: Partial<BrandMetrics> = {}): BrandMetrics => ({
  slug, name: slug, website: null, mrrUsd: 0, clients: 0, newLeads: 0,
  offersSent: 0, offersAwaiting: 0, responseSeconds: [], ...values,
});

describe("Lochside cross-brand totals", () => {
  it("adds BKC and TREB while keeping their own figures and true combined median", () => {
    const result = summarizeCompanyMetrics([
      brand("bookkeeping-conroe", { mrrUsd: 3105, clients: 5, newLeads: 2, offersSent: 3, offersAwaiting: 1, responseSeconds: [60, 120, 180] }),
      brand("real-estate-bookkeeper", { mrrUsd: 500, clients: 1, newLeads: 4, offersSent: 2, offersAwaiting: 2, responseSeconds: [3600] }),
    ], null, new Date("2026-11-22T12:00:00Z"));
    expect(result.total).toMatchObject({ mrrUsd: 3605, clients: 6, newLeads: 6, offersSent: 5, offersAwaiting: 3, medianResponseSeconds: 150 });
    expect(result.brands.map((view) => view.mrrUsd)).toEqual([3105, 500]);
    expect(result.cashFlow).toBeNull();
  });

  it("shows a dated stale cash flow but never replaces it with MRR", () => {
    const result = summarizeCompanyMetrics([brand("bookkeeping-conroe", { mrrUsd: 3105 })],
      { month: "2026-09", incomeUsd: 9000, expensesUsd: 3000, ownerDrawUsd: 2000, taxSetAsideUsd: 1000 },
      new Date("2026-11-22T12:00:00Z"));
    expect(result.cashFlow).toEqual({ month: "2026-09", asOf: "2026-09-30", valueUsd: 3000, stale: true });
    expect(result.total.mrrUsd).toBe(3105);
    expect(result.expectedMonth).toBe("2026-10");
  });
});

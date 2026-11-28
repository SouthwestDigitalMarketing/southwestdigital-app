import { describe, expect, it } from "vitest";
import {
  applyGrowPriceOverride,
  buildPackagePricing,
  derivedPricingComplexityLevel,
  emptyPackagePricingInputs,
  getMonthlyRateBreakdown,
  PACKAGE_PRICING,
  type PackagePricingInputs,
} from "@/lib/quotes/packagePricing";

/**
 * Spec 02 golden part 2 (freeze rule): threshold bands the original golden
 * file never pinned — staffing / reconciliation / platform / pass-through,
 * unknown + empty bands, discretionaryMultiplier != 1, adjustmentItems, and
 * the advanced-score boundary.
 *
 * Every expectation below is a literal captured from current code (2026-11-28)
 * and hand-checked against the constants in packagePricing.ts, NOT generated
 * from the implementation at test time. packagePricing.ts must stay behaviour-
 * identical: any drift fails loudly instead of being re-baselined.
 */

function inputs(overrides: Partial<PackagePricingInputs>): PackagePricingInputs {
  return { ...emptyPackagePricingInputs(), ...overrides };
}

describe("spec 02 golden: threshold bands and multiplier", () => {
  it("prices a 3-person staffing load on the staffing band (maintain 355)", () => {
    const assessment = inputs({ employeesCount: 2, contractorsCount: 1 });
    // 250 base + 3 x 35 staffing = 355, standard (headcount score 1).
    expect(derivedPricingComplexityLevel(assessment)).toBe("standard");
    const priced = buildPackagePricing(PACKAGE_PRICING.maintain, assessment, 0, 0);
    expect({ ...priced }).toEqual({
      packageId: "maintain",
      complexityLevel: "standard",
      monthly: 355,
      catchUpBase: 0,
      assessmentOneTimeAdjustments: 0,
      totalOneTimeBeforeManual: 0,
      totalOneTime: 0,
    });
    expect(getMonthlyRateBreakdown(PACKAGE_PRICING.maintain, assessment, "standard")).toEqual({
      baseItems: [
        { label: "Base monthly package", amount: 250 },
        { label: "Staffing", amount: 105 },
      ],
      adjustmentItems: [],
    });
    // Improve staffs at 45/person: 250 + 135 = 385.
    expect(buildPackagePricing(PACKAGE_PRICING.improve, assessment, 0, 0).monthly).toBe(385);
  });

  it("prices 12 reconciliation accounts on the reconciliation band (maintain 360)", () => {
    const assessment = inputs({ bankAccountsCount: 7, creditCardsCount: 5 });
    // 12 accounts -> 110 on the maintain reconciliation band; score 1 -> standard.
    expect(derivedPricingComplexityLevel(assessment)).toBe("standard");
    expect(buildPackagePricing(PACKAGE_PRICING.maintain, assessment, 0, 0).monthly).toBe(360);
    expect(getMonthlyRateBreakdown(PACKAGE_PRICING.maintain, assessment, "standard").baseItems).toEqual([
      { label: "Base monthly package", amount: 250 },
      { label: "Reconciliation load", amount: 110 },
    ]);
    // Improve reconciles 12 accounts at 140: 250 + 140 = 390.
    expect(buildPackagePricing(PACKAGE_PRICING.improve, assessment, 0, 0).monthly).toBe(390);
  });

  it("prices 3 known payment platforms on the platform band (maintain 330)", () => {
    const assessment = inputs({ paymentPlatforms: ["paypal", "stripe", "venmo"] });
    // 3 known platforms -> 80 on the maintain platform band; score 1 -> standard.
    expect(derivedPricingComplexityLevel(assessment)).toBe("standard");
    expect(buildPackagePricing(PACKAGE_PRICING.maintain, assessment, 0, 0).monthly).toBe(330);
    expect(getMonthlyRateBreakdown(PACKAGE_PRICING.maintain, assessment, "standard").baseItems).toEqual([
      { label: "Base monthly package", amount: 250 },
      { label: "Connected platforms", amount: 80 },
    ]);
    // Improve connects 3 platforms at 110: 250 + 110 = 360.
    expect(buildPackagePricing(PACKAGE_PRICING.improve, assessment, 0, 0).monthly).toBe(360);
  });

  it("prices 3 pass-through channels on the pass-through band (maintain 360)", () => {
    const assessment = inputs({ zeroBalancePlatformCount: 3 });
    // 3 pass-through channels -> 110 on the maintain band; score 1 -> standard.
    expect(derivedPricingComplexityLevel(assessment)).toBe("standard");
    expect(buildPackagePricing(PACKAGE_PRICING.maintain, assessment, 0, 0).monthly).toBe(360);
    expect(getMonthlyRateBreakdown(PACKAGE_PRICING.maintain, assessment, "standard").baseItems).toEqual([
      { label: "Base monthly package", amount: 250 },
      { label: "Pass-through accounts", amount: 110 },
    ]);
    // Improve passes 3 channels at 140: 250 + 140 = 390.
    expect(buildPackagePricing(PACKAGE_PRICING.improve, assessment, 0, 0).monthly).toBe(390);
  });

  it("prices unknown and empty transaction bands at the base 250", () => {
    // "unknown" is a priced band key worth 0 on every tier; "" skips the lookup.
    expect(buildPackagePricing(PACKAGE_PRICING.maintain, inputs({ transactionBand: "unknown" }), 0, 0).monthly).toBe(250);
    expect(buildPackagePricing(PACKAGE_PRICING.maintain, inputs({ transactionBand: "" }), 0, 0).monthly).toBe(250);
    expect(
      getMonthlyRateBreakdown(PACKAGE_PRICING.maintain, inputs({ transactionBand: "unknown" }), "standard"),
    ).toEqual({
      baseItems: [{ label: "Base monthly package", amount: 250 }],
      adjustmentItems: [],
    });
  });

  it("scales the base by a non-1 discretionary multiplier with an adjustment item", () => {
    const assessment = inputs({ discretionaryMultiplier: 1.1 });
    // ceil5(250 x 1.1) = 275; the +25 lives in adjustmentItems, not baseItems.
    const priced = buildPackagePricing(PACKAGE_PRICING.maintain, assessment, 0, 0);
    expect(priced.monthly).toBe(275);
    expect(getMonthlyRateBreakdown(PACKAGE_PRICING.maintain, assessment, "standard")).toEqual({
      baseItems: [{ label: "Base monthly package", amount: 250 }],
      adjustmentItems: [{ label: "Discretionary multiplier (1.10x)", amount: 25 }],
    });
  });

  it("hits the advanced boundary at score 9 and stays complex at score 8", () => {
    const base = {
      transactionBand: "1000+",
      numberOfProperties: 10,
      numberOfEntities: 3,
      employeesCount: 8,
    };
    // tx 3 + properties 2 + entities 2 + headcount 2 = 9 -> advanced.
    const advanced = inputs(base);
    expect(derivedPricingComplexityLevel(advanced)).toBe("advanced");
    // 250 + 500 + 300 + 350 + 280 + 280 = 1960.
    const priced = buildPackagePricing(PACKAGE_PRICING.maintain, advanced, 0, 0);
    expect({ ...priced }).toEqual({
      packageId: "maintain",
      complexityLevel: "advanced",
      monthly: 1960,
      catchUpBase: 0,
      // Backlog: 10 x 20 properties + 3 x 50 entities = 350.
      assessmentOneTimeAdjustments: 350,
      totalOneTimeBeforeManual: 350,
      totalOneTime: 350,
    });
    // One fewer employee: headcount score drops to 1, total 8 -> complex.
    const complex = inputs({ ...base, employeesCount: 7 });
    expect(derivedPricingComplexityLevel(complex)).toBe("complex");
    // 250 + 500 + 300 + 150 + 280 + 245 = 1725.
    expect(buildPackagePricing(PACKAGE_PRICING.maintain, complex, 0, 0).monthly).toBe(1725);
    // Grow still derives from maintain: ceil5(1960 x 1.5) = 2940.
    const tiers = applyGrowPriceOverride({
      grow: buildPackagePricing(PACKAGE_PRICING.grow, advanced, 0, 0),
      improve: buildPackagePricing(PACKAGE_PRICING.improve, advanced, 0, 0),
      maintain: priced,
    });
    expect(tiers.grow.monthly).toBe(2940);
  });
});

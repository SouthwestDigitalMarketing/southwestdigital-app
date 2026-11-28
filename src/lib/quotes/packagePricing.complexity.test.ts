import { describe, expect, it } from "vitest";
import {
  applyGrowPriceOverride,
  buildPackagePricing,
  emptyPackagePricingInputs,
  getMonthlyRateBreakdown,
  knownPaymentPlatformCount,
  onlineStorePayoutOverlap,
  PACKAGE_PRICING,
  type PackagePricingInputs,
} from "./packagePricing";

function inputs(overrides: Partial<PackagePricingInputs>): PackagePricingInputs {
  return { ...emptyPackagePricingInputs(), ...overrides };
}

const INVENTORY = { drivers: { inventory_cogs: { checked: true } } };

describe("spec 03 package pricing hook", () => {
  it("leaves legacy pricing byte-identical without a selection", () => {
    const assessment = inputs({});
    expect(buildPackagePricing(PACKAGE_PRICING.maintain, assessment, 0, 0)).toEqual({
      packageId: "maintain",
      complexityLevel: "standard",
      monthly: 250,
      catchUpBase: 0,
      assessmentOneTimeAdjustments: 0,
      totalOneTimeBeforeManual: 0,
      totalOneTime: 0,
    });
    expect("complexity" in buildPackagePricing(PACKAGE_PRICING.maintain, assessment, 0, 0)).toBe(false);
    expect(getMonthlyRateBreakdown(PACKAGE_PRICING.maintain, assessment, "standard")).toEqual({
      baseItems: [{ label: "Base monthly package", amount: 250 }],
      adjustmentItems: [],
    });
  });

  it("adds a new driver's monthly into maintain and improve, scaled by tier", () => {
    const assessment = inputs({ complexity: INVENTORY });
    // Maintain charges the code default exactly.
    expect(buildPackagePricing(PACKAGE_PRICING.maintain, assessment, 0, 0).monthly).toBe(345);
    // Improve scales 95 x 1.25, ceil $5 -> 120.
    expect(buildPackagePricing(PACKAGE_PRICING.improve, assessment, 0, 0).monthly).toBe(370);
    const breakdown = getMonthlyRateBreakdown(
      PACKAGE_PRICING.improve,
      assessment,
      "standard",
    );
    expect(breakdown.baseItems).toContainEqual({
      label: "Complexity — Inventory and cost of goods",
      amount: 120,
    });
  });

  it("grows via the existing override, not bottom-up", () => {
    const assessment = inputs({ complexity: INVENTORY });
    const priced = applyGrowPriceOverride({
      grow: buildPackagePricing(PACKAGE_PRICING.grow, assessment, 0, 0),
      improve: buildPackagePricing(PACKAGE_PRICING.improve, assessment, 0, 0),
      maintain: buildPackagePricing(PACKAGE_PRICING.maintain, assessment, 0, 0),
    });
    // Maintain 345 x 1.5, ceil $5 -> 520. The charged figure is the pipeline
    // total, matching the contract's complexityGrowMonthlyTotal rule.
    expect(priced.maintain.monthly).toBe(345);
    expect(priced.grow.monthly).toBe(520);
  });

  it("counts a store's own payout channel once (store wins)", () => {
    const withoutStore = inputs({ paymentPlatforms: ["stripe", "paypal", "venmo"] });
    expect(knownPaymentPlatformCount(withoutStore)).toBe(3);
    const withStore = inputs({
      paymentPlatforms: ["stripe", "paypal", "venmo"],
      complexity: { drivers: { online_store: { checked: true, name: "Stripe" } } },
    });
    expect(onlineStorePayoutOverlap({
      paymentPlatforms: withStore.paymentPlatforms,
      complexity: withStore.complexity,
    })).toBe("stripe");
    // Two platforms left on the maintain band: 40 instead of 80.
    expect(knownPaymentPlatformCount(withStore)).toBe(2);
    expect(buildPackagePricing(PACKAGE_PRICING.maintain, withoutStore, 0, 0).monthly).toBe(330);
    expect(buildPackagePricing(PACKAGE_PRICING.maintain, withStore, 0, 0).monthly).toBe(345);
  });

  it("never matches other/unknown channels and ignores an unchecked store", () => {
    expect(
      onlineStorePayoutOverlap({ paymentPlatforms: ["other"], complexity: INVENTORY }),
    ).toBeNull();
    expect(
      onlineStorePayoutOverlap({
        paymentPlatforms: ["stripe"],
        complexity: { drivers: { online_store: { checked: false, name: "Stripe" } } },
      }),
    ).toBeNull();
    expect(onlineStorePayoutOverlap({ paymentPlatforms: ["stripe"], complexity: null })).toBeNull();
  });

  it("turns an absent existing line into a waiting line instead of charging", () => {
    const waiting = inputs({
      complexity: { drivers: { sales_tax: { checked: true } } },
      offerSalesTaxFiling: false,
    });
    const priced = buildPackagePricing(PACKAGE_PRICING.maintain, waiting, 0, 0);
    expect(priced.monthly).toBe(250);
    expect(priced.complexity?.lines).toEqual([
      expect.objectContaining({ id: "sales_tax", monthly: 0, requiresExistingLine: "salesTaxAddon" }),
    ]);
    const included = inputs({
      complexity: { drivers: { sales_tax: { checked: true } } },
      offerSalesTaxFiling: true,
    });
    expect(buildPackagePricing(PACKAGE_PRICING.maintain, included, 0, 0).complexity?.lines).toEqual([
      expect.objectContaining({ id: "sales_tax", monthly: 0, includedNote: expect.any(String) }),
    ]);
  });

  it("resolves template defaults under overrides, per driver field", () => {
    const assessment = inputs({
      complexity: {
        drivers: {
          inventory_cogs: { checked: true, monthlyOverride: 500 },
          pos_system: { checked: true },
        },
      },
      complexityDriverDefaults: { pos_system: { monthly: 200 } },
    });
    const priced = buildPackagePricing(PACKAGE_PRICING.maintain, assessment, 0, 0);
    // Exact per-proposal override beats everything; template beats code default.
    expect(priced.monthly).toBe(250 + 500 + 200);
    expect(priced.complexity?.monthlyTotal).toBe(700);
  });

  it("scales 1099 payee math by tier and drops the line without payees", () => {
    const assessment = inputs({
      complexity: { drivers: { filing_1099: { checked: true, count: 10 } } },
    });
    expect(buildPackagePricing(PACKAGE_PRICING.maintain, assessment, 0, 0).monthly).toBe(330);
    expect(buildPackagePricing(PACKAGE_PRICING.improve, assessment, 0, 0).monthly).toBe(350);
    const noPayees = inputs({ complexity: { drivers: { filing_1099: { checked: true } } } });
    const priced = buildPackagePricing(PACKAGE_PRICING.maintain, noPayees, 0, 0);
    expect(priced.monthly).toBe(250);
    expect(priced.complexity?.lines).toEqual([]);
  });
});

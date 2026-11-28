import { describe, expect, it } from "vitest";
import {
  applyGrowPriceOverride,
  buildPackagePricing,
  emptyPackagePricingInputs,
  getMonthlyRateBreakdown,
  knownPaymentPlatformCount,
  onlineStorePayoutOverlap,
  payoutChannelExclusions,
  PACKAGE_PRICING,
  shopifyPayoutSuggestion,
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

  it("stores pipeline-consistent grow complexity for the review basket (730 monthly, 585 cleanup)", () => {
    const basket = inputs({
      complexity: {
        drivers: {
          inventory_cogs: { checked: true },
          pos_system: { checked: true, name: "Lightspeed" },
          online_store: { checked: true, name: "Shopify" },
          loans_mca: { checked: true, count: 2 },
          personal_commingling: { checked: true },
          filing_1099: { checked: true, count: 12 },
          sales_tax: { checked: true },
        },
      },
    });
    const priced = applyGrowPriceOverride({
      grow: buildPackagePricing(PACKAGE_PRICING.grow, basket, 6, 0),
      improve: buildPackagePricing(PACKAGE_PRICING.improve, basket, 6, 0),
      maintain: buildPackagePricing(PACKAGE_PRICING.maintain, basket, 6, 0),
    });
    expect(priced.maintain.complexity?.monthlyTotal).toBe(486);
    expect(priced.maintain.complexity?.cleanupTotal).toBe(390);
    // Stored grow lines sum to the charged rule ceil5(486 x 1.5) = 730;
    // cleanup follows the total-level rule ceil5(390 x 1.5) = 585.
    expect(priced.grow.complexity?.monthlyTotal).toBe(730);
    expect(
      (priced.grow.complexity?.lines ?? []).map((line) => line.monthly).reduce((a, b) => a + b, 0),
    ).toBe(730);
    expect(priced.grow.complexity?.cleanupTotal).toBe(585);
  });

  it("counts a store's chosen payout channel once (store wins)", () => {
    const withoutChoice = inputs({
      paymentPlatforms: ["stripe", "paypal", "venmo"],
      complexity: { drivers: { online_store: { checked: true, name: "Shopify" } } },
    });
    // No choice: nothing excluded — a genuinely separate Stripe account
    // stays charged (3 platforms -> 80).
    expect(payoutChannelExclusions({
      paymentPlatforms: withoutChoice.paymentPlatforms,
      complexity: withoutChoice.complexity,
    })).toEqual([]);
    expect(onlineStorePayoutOverlap({
      paymentPlatforms: withoutChoice.paymentPlatforms,
      complexity: withoutChoice.complexity,
    })).toBeNull();
    expect(knownPaymentPlatformCount(withoutChoice)).toBe(3);
    const withChoice = inputs({
      paymentPlatforms: ["stripe", "paypal", "venmo"],
      complexity: { drivers: { online_store: { checked: true, name: "Shopify", payoutPlatform: "stripe" } } },
    });
    expect(payoutChannelExclusions({
      paymentPlatforms: withChoice.paymentPlatforms,
      complexity: withChoice.complexity,
    })).toEqual(["stripe"]);
    expect(onlineStorePayoutOverlap({
      paymentPlatforms: withChoice.paymentPlatforms,
      complexity: withChoice.complexity,
    })).toBe("stripe");
    // Two platforms left on the maintain band: 40 instead of 80.
    expect(knownPaymentPlatformCount(withChoice)).toBe(2);
    expect(buildPackagePricing(PACKAGE_PRICING.maintain, withoutChoice, 0, 0).monthly).toBe(385);
    expect(buildPackagePricing(PACKAGE_PRICING.maintain, withChoice, 0, 0).monthly).toBe(345);
  });

  it("never excludes without an explicit listed choice", () => {
    const cases: Array<{ paymentPlatforms: string[]; complexity: unknown }> = [
      // Name alone never matches, even when it equals the platform.
      { paymentPlatforms: ["stripe"], complexity: { drivers: { online_store: { checked: true, name: "Stripe" } } } },
      { paymentPlatforms: ["other"], complexity: INVENTORY },
      // `unknown` and empty choices never match.
      {
        paymentPlatforms: ["stripe"],
        complexity: { drivers: { online_store: { checked: true, name: "Shopify", payoutPlatform: "unknown" } } },
      },
      {
        paymentPlatforms: ["stripe"],
        complexity: { drivers: { online_store: { checked: true, name: "Shopify", payoutPlatform: "" } } },
      },
      // An unchecked driver never excludes, even with a choice set.
      {
        paymentPlatforms: ["stripe"],
        complexity: { drivers: { online_store: { checked: false, name: "Shopify", payoutPlatform: "stripe" } } },
      },
      // A choice for a platform not on the assessment excludes nothing.
      {
        paymentPlatforms: ["paypal"],
        complexity: { drivers: { online_store: { checked: true, name: "Shopify", payoutPlatform: "stripe" } } },
      },
      { paymentPlatforms: ["stripe"], complexity: null },
    ];
    for (const { paymentPlatforms, complexity } of cases) {
      expect(onlineStorePayoutOverlap({ paymentPlatforms, complexity })).toBeNull();
      expect(payoutChannelExclusions({ paymentPlatforms, complexity })).toEqual([]);
    }
  });

  it("excludes the pos payout channel too, store first", () => {
    const posOnly = inputs({
      paymentPlatforms: ["stripe", "paypal"],
      complexity: { drivers: { pos_system: { checked: true, name: "Square", payoutPlatform: "stripe" } } },
    });
    expect(payoutChannelExclusions({
      paymentPlatforms: posOnly.paymentPlatforms,
      complexity: posOnly.complexity,
    })).toEqual(["stripe"]);
    expect(onlineStorePayoutOverlap({
      paymentPlatforms: posOnly.paymentPlatforms,
      complexity: posOnly.complexity,
    })).toBe("stripe");
    expect(knownPaymentPlatformCount(posOnly)).toBe(1);
    // Both drivers claiming different listed channels excludes both.
    const both = inputs({
      paymentPlatforms: ["stripe", "paypal", "venmo"],
      complexity: {
        drivers: {
          online_store: { checked: true, name: "Shopify", payoutPlatform: "stripe" },
          pos_system: { checked: true, name: "Clover", payoutPlatform: "paypal" },
        },
      },
    });
    expect(payoutChannelExclusions({
      paymentPlatforms: both.paymentPlatforms,
      complexity: both.complexity,
    })).toEqual(["stripe", "paypal"]);
    expect(knownPaymentPlatformCount(both)).toBe(1);
  });

  it("suggests Stripe for a Shopify store without excluding it", () => {
    const shopifyNoChoice = {
      paymentPlatforms: ["stripe"],
      complexity: { drivers: { online_store: { checked: true, name: "Shopify" } } },
    };
    expect(shopifyPayoutSuggestion(shopifyNoChoice)).toBe(true);
    // Suggestion only: pricing still charges the platform.
    expect(onlineStorePayoutOverlap(shopifyNoChoice)).toBeNull();
    expect(knownPaymentPlatformCount(inputs(shopifyNoChoice))).toBe(1);
    // No suggestion once a channel is chosen, without Stripe listed, or
    // for a non-Shopify store name.
    expect(shopifyPayoutSuggestion({
      paymentPlatforms: ["stripe"],
      complexity: { drivers: { online_store: { checked: true, name: "Shopify", payoutPlatform: "stripe" } } },
    })).toBe(false);
    expect(shopifyPayoutSuggestion({
      paymentPlatforms: ["paypal"],
      complexity: { drivers: { online_store: { checked: true, name: "Shopify" } } },
    })).toBe(false);
    expect(shopifyPayoutSuggestion({
      paymentPlatforms: ["stripe"],
      complexity: { drivers: { online_store: { checked: true, name: "WooCommerce" } } },
    })).toBe(false);
    expect(shopifyPayoutSuggestion({
      paymentPlatforms: ["stripe"],
      complexity: { drivers: { online_store: { checked: false, name: "Shopify" } } },
    })).toBe(false);
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

import { describe, expect, it } from "vitest";
import {
  applyRule,
  basePackageAmount,
  computeQuoteLineItems,
  createLegacyUrgencyAdjustment,
  resolveCleanupMonths,
  transactionVolume,
} from "./pricing";
import type { PackageForPricing, QuoteInputs } from "./types";

describe("transactionVolume", () => {
  it("maps named bands and numeric input", () => {
    expect(transactionVolume("low")).toBe(50);
    expect(transactionVolume("medium")).toBe(150);
    expect(transactionVolume("high")).toBe(400);
    expect(transactionVolume(275)).toBe(275);
    expect(transactionVolume(undefined)).toBe(100);
  });
});

describe("resolveCleanupMonths", () => {
  it("uses inclusive start/end months when both are valid", () => {
    expect(
      resolveCleanupMonths({ cleanup_start_month: "2025-01", cleanup_end_month: "2025-06" }),
    ).toBe(6);
  });

  it("falls back to cleanup_period_months", () => {
    expect(resolveCleanupMonths({ cleanup_period_months: 18 })).toBe(18);
  });

  it("returns 0 when nothing is set", () => {
    expect(resolveCleanupMonths({})).toBe(0);
  });
});

describe("applyRule", () => {
  const inputs: QuoteInputs = {
    base_amount: 400,
    number_of_properties: 3,
    number_of_entities: 2,
    transaction_volume_estimate: "medium",
    complexity_level: "complex",
    urgency_level: "expedited",
    cleanup_start_month: "2025-01",
    cleanup_end_month: "2025-04",
  };

  it("applies base_amount_multiplier", () => {
    expect(applyRule("base_amount_multiplier", { multiplier: 1.25 }, null, null, inputs)).toBe(500);
  });

  it("applies flat and per-unit rules", () => {
    expect(applyRule("flat", { amount: 250 }, null, null, inputs)).toBe(250);
    expect(applyRule("per_property", { rate_per_unit: 40 }, null, null, inputs)).toBe(120);
    expect(applyRule("per_entity", { rate_per_unit: 75 }, null, null, inputs)).toBe(150);
    expect(applyRule("per_transaction", { rate_per_unit: 2 }, null, null, inputs)).toBe(300);
    expect(applyRule("per_cleanup_month", { rate_per_unit: 100 }, null, null, inputs)).toBe(400);
  });

  it("applies cleanup_from_base_amount", () => {
    expect(applyRule("cleanup_from_base_amount", { multiplier: 0.5 }, null, null, inputs)).toBe(800);
  });

  it("clamps to min and max", () => {
    expect(applyRule("flat", { amount: 50 }, 100, 200, inputs)).toBe(100);
    expect(applyRule("flat", { amount: 500 }, 100, 200, inputs)).toBe(200);
  });

  it("selects a matching tier", () => {
    expect(
      applyRule(
        "tiered",
        {
          dimension: "properties",
          tiers: [
            { min: 1, max: 2, price: 100 },
            { min: 3, max: 10, price: 250 },
          ],
        },
        null,
        null,
        inputs,
      ),
    ).toBe(250);
  });

  it("returns 0 for unknown rule types", () => {
    expect(applyRule("custom", {}, null, null, inputs)).toBe(0);
  });
});

describe("basePackageAmount", () => {
  it("uses FIXED priceValue as-is", () => {
    expect(basePackageAmount("FIXED", 899, 400)).toBe(899);
  });

  it("multiplies BASE_MULTIPLIER against base amount", () => {
    expect(basePackageAmount("BASE_MULTIPLIER", 1.5, 400)).toBe(600);
  });
});

describe("createLegacyUrgencyAdjustment", () => {
  it("adds 15% to recurring subtotal for expedited", () => {
    const adj = createLegacyUrgencyAdjustment(
      [{ label: "Monthly", amount: 400, billingType: "recurring" }],
      "expedited",
    );
    expect(adj?.amount).toBe(60);
    expect(adj?.billingType).toBe("recurring");
  });

  it("adds 30% for rush", () => {
    const adj = createLegacyUrgencyAdjustment(
      [{ label: "Cleanup", amount: 1000, billingType: "one_time" }],
      "rush",
    );
    expect(adj?.amount).toBe(300);
  });

  it("skips standard urgency", () => {
    expect(
      createLegacyUrgencyAdjustment(
        [{ label: "Monthly", amount: 400, billingType: "recurring" }],
        "standard",
      ),
    ).toBeNull();
  });
});

describe("computeQuoteLineItems", () => {
  it("uses pricing rules and adds onboarding as one-time", () => {
    const pkg: PackageForPricing = {
      name: "Grow",
      scenario: "MONTHLY_BOOKKEEPING",
      billingType: "recurring",
      priceMode: "FIXED",
      priceValue: 0,
      onboardingFee: 250,
      pricingRules: [
        {
          name: "Monthly investment",
          description: null,
          ruleType: "flat",
          configJson: { amount: 400 },
          minPrice: null,
          maxPrice: null,
          billingType: "recurring",
        },
      ],
    };

    const result = computeQuoteLineItems(pkg, {});
    expect(result.totals.recurring).toBe(400);
    expect(result.totals.oneTime).toBe(250);
    expect(result.totals.onboardingFee).toBe(250);
    expect(result.lineItems.map((item) => item.label)).toEqual([
      "Monthly investment",
      "Onboarding & Setup",
    ]);
  });

  it("falls back to package price when there are no rules", () => {
    const pkg: PackageForPricing = {
      name: "Maintain",
      scenario: "MONTHLY_BOOKKEEPING",
      billingType: "recurring",
      priceMode: "BASE_MULTIPLIER",
      priceValue: 1,
      onboardingFee: null,
      pricingRules: [],
    };

    const result = computeQuoteLineItems(pkg, { base_amount: 400, urgency_level: "expedited" });
    expect(result.totals.recurring).toBe(460);
    expect(result.lineItems).toHaveLength(2);
  });
});

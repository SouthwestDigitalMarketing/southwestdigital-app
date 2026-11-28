import { describe, expect, it } from "vitest";
import {
  buildProposalCheckoutSummary,
  parseStoredProposalCheckout,
} from "./proposalCheckout";

const snapshot = {
  assessment: {
    annualSavingsPercent: 20,
    waiveOnboardingFee: false,
    onboardingFeeOverride: null,
    historicalCleanupPeriods: [
      { year: 2026, startMonth: 1, endMonth: 3 },
      { year: 2025, startMonth: 11, endMonth: 12 },
    ],
    additionalOptions: [],
  },
  pricing: {
    maintain: {
      monthly: 300,
      complexity: { lines: [], monthlyTotal: 0, cleanupPerMonthTotal: 65, cleanupTotal: 325 },
    },
    improve: { monthly: 450 },
    grow: { monthly: 600 },
  },
};

describe("spec 03 checkout complexity cleanup", () => {
  it("adds the snapshot's per-month cleanup weight to the estimate only", () => {
    const result = buildProposalCheckoutSummary(snapshot, {
      tier: "maintain",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: ["2026-1-3"],
      selectedAdditionalOptionIds: [],
    });
    // 3 selected months x 65 + the base 3 x 300 estimate.
    expect(result.cleanupMonths).toBe(3);
    expect(result.cleanupTotal).toBe(900 + 195);
    expect(result.complexityCleanupAdd).toBe(195);
    // The monthly rate and today's charge are untouched by the add.
    expect(result.cleanupMonthlyRate).toBe(300);
    expect(result.amountDueNow).toBe(560);
    expect(result.oneTimeTotal).toBe(560);
    expect(parseStoredProposalCheckout(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });

  it("adds nothing without selected cleanup months", () => {
    const result = buildProposalCheckoutSummary(snapshot, {
      tier: "maintain",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: [],
      selectedAdditionalOptionIds: [],
    });
    expect(result.cleanupTotal).toBe(0);
    expect(result.complexityCleanupAdd).toBeUndefined();
  });

  it("leaves legacy snapshots without lines exactly as before", () => {
    const legacy = {
      assessment: snapshot.assessment,
      pricing: {
        maintain: { monthly: 300 },
        improve: { monthly: 450 },
        grow: { monthly: 600 },
      },
    };
    const result = buildProposalCheckoutSummary(legacy, {
      tier: "maintain",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: ["2026-1-3"],
      selectedAdditionalOptionIds: [],
    });
    expect(result.cleanupTotal).toBe(900);
    expect(result.complexityCleanupAdd).toBeUndefined();
    expect(result.amountDueNow).toBe(560);
  });
});

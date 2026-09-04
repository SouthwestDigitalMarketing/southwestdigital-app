import { describe, expect, it } from "vitest";
import {
  buildProposalCheckoutSummary,
  applyOnboardingWaiver,
  parseProposalCheckoutSelection,
  resolveAmountDueNow,
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
    additionalOptions: [
      { id: "reporting", monthlyPrice: 75, showInProposal: true, archived: false },
      { id: "hidden", monthlyPrice: 999, showInProposal: false, archived: false },
    ],
  },
  pricing: {
    maintain: { monthly: 300 },
    improve: { monthly: 450 },
    grow: { monthly: 600 },
  },
};

describe("proposal checkout", () => {
  it("rejects a missing or invalid tier", () => {
    expect(parseProposalCheckoutSelection({ tier: "free" })).toBeNull();
  });

  it("charges onboarding plus the first month when cleanup is not selected", () => {
    const result = buildProposalCheckoutSummary(snapshot, {
      tier: "maintain",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: [],
      selectedAdditionalOptionIds: ["reporting", "hidden", "made-up"],
    });
    expect(result.recurringMonthlyTotal).toBe(375);
    expect(result.onboardingFee).toBe(500);
    expect(result.amountDueNow).toBe(875);
    expect(result.selectedAdditionalOptionIds).toEqual(["reporting"]);
    expect(result.chargeKind).toBe("onboarding_and_first_month");
  });

  it("charges selected cleanup plus onboarding and defers the monthly charge", () => {
    const result = buildProposalCheckoutSummary(snapshot, {
      tier: "improve",
      hasTwelveMonthAgreement: true,
      selectedCleanupPeriodKeys: ["2026-1-3", "invalid"],
      selectedAdditionalOptionIds: [],
    });
    expect(result.recurringMonthlyTotal).toBe(360);
    expect(result.cleanupTotal).toBe(900);
    expect(result.onboardingFee).toBe(560);
    expect(result.amountDueNow).toBe(1460);
    expect(result.selectedCleanupPeriodKeys).toEqual(["2026-1-3"]);
    expect(result.chargeKind).toBe("onboarding_and_cleanup");
  });

  it("subtracts only onboarding when a promotion waives it", () => {
    expect(resolveAmountDueNow({
      checkout: { amountDueNow: 875, onboardingFee: 500 },
      onboardingWaived: true,
      isTestProposal: false,
    })).toBe(375);
  });

  it("freezes an onboarding waiver into the checkout summary", () => {
    const original = buildProposalCheckoutSummary(snapshot, {
      tier: "maintain",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: [],
      selectedAdditionalOptionIds: [],
    });
    const waived = applyOnboardingWaiver(original);
    expect(waived.onboardingFee).toBe(0);
    expect(waived.oneTimeTotal).toBe(0);
    expect(waived.amountDueNow).toBe(300);
    expect(waived.chargeKind).toBe("first_month");
    expect(waived.selectionHash).not.toBe(original.selectionHash);
  });

  it("forces an explicitly marked test proposal to one dollar", () => {
    expect(resolveAmountDueNow({
      checkout: { amountDueNow: 875, onboardingFee: 500 },
      onboardingWaived: false,
      isTestProposal: true,
    })).toBe(1);
  });
});

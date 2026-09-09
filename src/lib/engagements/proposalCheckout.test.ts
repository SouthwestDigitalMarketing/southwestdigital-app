import { describe, expect, it } from "vitest";
import {
  buildProposalCheckoutSummary,
  applyOnboardingWaiver,
  parseProposalCheckoutSelection,
  parseStoredProposalCheckout,
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

  it("charges onboarding and discovery while deferring the cleanup estimate and monthly charge", () => {
    const result = buildProposalCheckoutSummary(snapshot, {
      tier: "improve",
      hasTwelveMonthAgreement: true,
      selectedCleanupPeriodKeys: ["2026-1-3", "invalid"],
      selectedAdditionalOptionIds: [],
    });
    expect(result.recurringMonthlyTotal).toBe(360);
    expect(result.cleanupTotal).toBe(900);
    expect(result.onboardingFee).toBe(560);
    expect(result.amountDueNow).toBe(560);
    expect(result.oneTimeTotal).toBe(560);
    expect(result.cleanupMonths).toBe(3);
    expect(result.cleanupMonthlyRate).toBe(300);
    expect(result.paymentScheduleVersion).toBe(2);
    expect(result.selectedCleanupPeriodKeys).toEqual(["2026-1-3"]);
    expect(result.chargeKind).toBe("onboarding_and_discovery");
    expect(parseStoredProposalCheckout(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });

  it("charges a selected one-time add-on now instead of adding it to MRR", () => {
    const oneTimeSnapshot = {
      ...snapshot,
      assessment: {
        ...snapshot.assessment,
        additionalOptions: [
          ...snapshot.assessment.additionalOptions,
          { id: "sales-tax", monthlyPrice: 650, billingCadence: "one-time", showInProposal: true, archived: false },
        ],
      },
    };
    const result = buildProposalCheckoutSummary(oneTimeSnapshot, {
      tier: "maintain",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: [],
      selectedAdditionalOptionIds: ["sales-tax"],
    });
    expect(result.recurringMonthlyTotal).toBe(300);
    expect(result.oneTimeTotal).toBe(1150);
    expect(result.amountDueNow).toBe(1450);
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

  it("requires no upfront payment for waived discovery even though cleanup has a later estimate", () => {
    const original = buildProposalCheckoutSummary(snapshot, {
      tier: "improve", hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: ["2026-1-3"], selectedAdditionalOptionIds: [],
    });
    const waived = applyOnboardingWaiver(original);
    expect(waived.amountDueNow).toBe(0);
    expect(waived.oneTimeTotal).toBe(0);
    expect(waived.cleanupTotal).toBe(900);
    expect(waived.chargeKind).toBe("onboarding_and_discovery");
  });

  it("keeps legacy signed cleanup amounts when reading stored checkout", () => {
    const saved = {
      tier: "improve", tierLabel: "Improve", hasTwelveMonthAgreement: true,
      selectedCleanupPeriodKeys: ["2026-1-3"], selectedAdditionalOptionIds: [],
      baseMonthlyTotal: 450, recurringMonthlyTotal: 360, cleanupTotal: 900,
      onboardingFee: 560, oneTimeTotal: 1460, amountDueNow: 1460,
      chargeKind: "onboarding_and_cleanup", selectionHash: "original-signed-hash",
    };
    expect(parseStoredProposalCheckout(saved)).toEqual(saved);
  });

  it("freezes included support descriptions with the selected package", () => {
    const result = buildProposalCheckoutSummary({ ...snapshot, assessment: {
      ...snapshot.assessment, bonuses: [
        { id: "priority", name: "Priority Client Support", description: "Same-business-day responses.", defaultPackageIds: ["improve"] },
        { id: "standard", name: "Standard Client Support", description: "1–2 business days.", defaultPackageIds: ["maintain"] },
      ],
    } }, { tier: "improve", hasTwelveMonthAgreement: false, selectedCleanupPeriodKeys: [], selectedAdditionalOptionIds: [] });
    expect(result.includedServices).toEqual([{ name: "Priority Client Support", description: "Same-business-day responses." }]);
  });
});

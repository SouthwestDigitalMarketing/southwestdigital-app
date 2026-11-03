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

  it("charges a required one-time add-on even when the client's selection leaves it out", () => {
    const withRequired = {
      ...snapshot,
      assessment: {
        ...snapshot.assessment,
        additionalOptions: [
          ...snapshot.assessment.additionalOptions,
          { id: "migration", monthlyPrice: 1000, billingCadence: "one-time", required: true, showInProposal: true, archived: false },
        ],
      },
    };
    const result = buildProposalCheckoutSummary(withRequired, {
      tier: "maintain",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: [],
      selectedAdditionalOptionIds: [],
    });
    expect(result.selectedAdditionalOptionIds).toEqual(["migration"]);
    expect(result.amountDueNow).toBe(500 + 1000 + 300);
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

  it("accepts zero recurring pricing for a test proposal", () => {
    const result = buildProposalCheckoutSummary({
      ...snapshot,
      isTestProposal: true,
      assessment: { ...snapshot.assessment, isTestProposal: true },
      pricing: {
        maintain: { monthly: 0 },
        improve: { monthly: 0 },
        grow: { monthly: 0 },
      },
    }, {
      tier: "grow",
      hasTwelveMonthAgreement: true,
      selectedCleanupPeriodKeys: ["2026-1-3"],
      selectedAdditionalOptionIds: ["reporting"],
    });

    expect(result).toMatchObject({
      baseMonthlyTotal: 0,
      recurringMonthlyTotal: 0,
      cleanupTotal: 0,
      onboardingFee: 0,
      oneTimeTotal: 1,
      amountDueNow: 1,
      chargeKind: "onboarding",
      cleanupMonths: 0,
      additionalOneTimeTotal: 0,
      selectedCleanupPeriodKeys: [],
      selectedAdditionalOptionIds: [],
    });
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
    // The frozen record uses the name the client saw on the proposal.
    expect(result.includedServices).toEqual([{ name: "Fast-Lane Support", description: "Same-business-day responses." }]);
  });
});

describe("twelve-month prepaid terms", () => {
  it("discounts add-ons as well as the base, and charges the whole year today", () => {
    const result = buildProposalCheckoutSummary(snapshot, {
      tier: "maintain",
      hasTwelveMonthAgreement: true,
      selectedCleanupPeriodKeys: [],
      selectedAdditionalOptionIds: ["reporting"],
    });
    // (300 base + 75 add-on) less 20% = 300/month, prepaid for a year.
    expect(result.recurringMonthlyTotal).toBe(300);
    expect(result.prepaidMonths).toBe(12);
    expect(result.amountDueNow).toBe(500 + 3600);
  });

  it("leaves a month-to-month term charging one month, with add-ons undiscounted", () => {
    const result = buildProposalCheckoutSummary(snapshot, {
      tier: "maintain",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: [],
      selectedAdditionalOptionIds: ["reporting"],
    });
    expect(result.recurringMonthlyTotal).toBe(375);
    expect(result.prepaidMonths).toBe(1);
    expect(result.amountDueNow).toBe(500 + 375);
  });
});

describe("first-payment credit", () => {
  const sel = (tier: "maintain" | "improve" | "grow") => ({
    tier, hasTwelveMonthAgreement: false, selectedCleanupPeriodKeys: [], selectedAdditionalOptionIds: [],
  });
  const withCredit = (firstPaymentCredit: number, waiveOnboardingFee = true) => ({
    ...snapshot,
    assessment: { ...snapshot.assessment, waiveOnboardingFee, onboardingFeeOverride: 500, firstPaymentCredit },
  });

  it("deducts the credit from the amount charged and records it", () => {
    const result = buildProposalCheckoutSummary(withCredit(800, false), sel("maintain"));
    expect(result.amountDueBeforeCredit).toBe(800);
    expect(result.creditApplied).toBe(800);
    expect(result.amountDueNow).toBe(0);
  });

  it("reduces what a $1,100 first payment charges by the $800 credit", () => {
    const result = buildProposalCheckoutSummary(
      { ...snapshot, assessment: { ...snapshot.assessment, onboardingFeeOverride: 800, firstPaymentCredit: 800 } },
      sel("maintain"),
    );
    expect(result.amountDueBeforeCredit).toBe(1100);
    expect(result.amountDueNow).toBe(300);
  });

  it("never takes the total below zero and caps the recorded credit", () => {
    const result = buildProposalCheckoutSummary(withCredit(5000), sel("maintain"));
    expect(result.amountDueNow).toBe(0);
    expect(result.creditApplied).toBe(result.amountDueBeforeCredit);
  });

  it("leaves a selection with no credit byte-identical to before", () => {
    const plain = buildProposalCheckoutSummary(snapshot, sel("maintain"));
    expect(plain).not.toHaveProperty("creditApplied");
    const zero = buildProposalCheckoutSummary(withCredit(0, false), { ...sel("maintain") });
    expect(zero).not.toHaveProperty("creditApplied");
  });

  it("re-caps the credit when a later waiver shrinks the amount due", () => {
    const built = buildProposalCheckoutSummary(withCredit(600, false), sel("maintain"));
    // maintain $300 + $500 onboarding = $800 before credit, $200 due
    expect(built.amountDueNow).toBe(200);
    const waived = applyOnboardingWaiver(built);
    expect(waived.amountDueBeforeCredit).toBe(300);
    expect(waived.creditApplied).toBe(300);
    expect(waived.amountDueNow).toBe(0);
  });

  it("round-trips through stored checkout parsing", () => {
    const built = buildProposalCheckoutSummary(withCredit(100, false), sel("maintain"));
    const parsed = parseStoredProposalCheckout(JSON.parse(JSON.stringify(built)));
    expect(parsed?.creditApplied).toBe(100);
    expect(parsed?.amountDueNow).toBe(700);
  });
});

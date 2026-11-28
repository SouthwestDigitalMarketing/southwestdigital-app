import { describe, expect, it } from "vitest";
import {
  applyOnboardingWaiver,
  buildProposalCheckoutSummary,
  parseStoredProposalCheckout,
} from "./proposalCheckout";

const snapshot = {
  assessment: {
    annualSavingsPercent: 20,
    waiveOnboardingFee: false,
    onboardingFeeOverride: null,
    historicalCleanupPeriods: [{ year: 2026, startMonth: 1, endMonth: 3 }],
    additionalOptions: [],
  },
  pricing: {
    maintain: { monthly: 300 },
    improve: { monthly: 450 },
    grow: { monthly: 600 },
  },
};

const sel = {
  tier: "maintain",
  hasTwelveMonthAgreement: false,
  selectedCleanupPeriodKeys: [] as string[],
  selectedAdditionalOptionIds: [] as string[],
} as const;

const plan = {
  caughtUpThrough: "2026-03",
  startDate: "2026-02-14",
  wrapUpDate: "2026-05-14",
  wrapUpSource: "default",
  paymentPlan: "monthly",
} as const;

describe("spec 06 checkout service start month", () => {
  it("stores an explicit staff month on a no-cleanup checkout", () => {
    const result = buildProposalCheckoutSummary({
      ...snapshot,
      assessment: { ...snapshot.assessment, serviceStartMonth: "2026-12" },
    }, { ...sel }, { todayISO: "2026-11-27" });
    expect(result.serviceStartMonth).toBe("2026-12");
    // Today's payment is untouched by the start month.
    expect(result.amountDueNow).toBe(800);
    expect(parseStoredProposalCheckout(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });

  it("derives the cleanup start from the wrap-up month when none was set", () => {
    const result = buildProposalCheckoutSummary({
      ...snapshot,
      assessment: { ...snapshot.assessment, cleanupPlan: { ...plan } },
    }, { ...sel, selectedCleanupPeriodKeys: ["2026-1-3"] }, { todayISO: "2026-02-01" });
    // Refreshed start 2026-02-15, 3 backlog months -> wrap-up 2026-03-17.
    expect(result.cleanupPlan?.wrapUpDate).toBe("2026-03-17");
    expect(result.serviceStartMonth).toBe("2026-03");
    expect(parseStoredProposalCheckout(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });

  it("ignores an explicit staff month when a cleanup plan was selected", () => {
    const result = buildProposalCheckoutSummary({
      ...snapshot,
      assessment: { ...snapshot.assessment, serviceStartMonth: "2026-09", cleanupPlan: { ...plan } },
    }, { ...sel, selectedCleanupPeriodKeys: ["2026-1-3"] }, { todayISO: "2026-02-01" });
    // Refreshed start 2026-02-15, 3 backlog months -> wrap-up 2026-03-17.
    expect(result.cleanupPlan?.wrapUpDate).toBe("2026-03-17");
    expect(result.serviceStartMonth).toBe("2026-03");
  });

  it("freezes the selection-date Chicago default on a plain monthly quote", () => {
    // No explicit month, no cleanup plan: the stored month is the default
    // for the selection date, so the agreement and receipt name it.
    const result = buildProposalCheckoutSummary(snapshot, { ...sel }, { todayISO: "2026-11-27" });
    expect(result.serviceStartMonth).toBe("2026-12");
    expect(result.amountDueNow).toBe(800);
    expect(parseStoredProposalCheckout(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });

  it("rolls the frozen default to January after a December selection", () => {
    const result = buildProposalCheckoutSummary(snapshot, { ...sel }, { todayISO: "2026-12-15" });
    expect(result.serviceStartMonth).toBe("2027-01");
  });

  it("leaves legacy stored checkouts without a month key on the legacy text", () => {
    const saved = {
      tier: "maintain", tierLabel: "Maintain", hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: ["2026-1-3"], selectedAdditionalOptionIds: [],
      baseMonthlyTotal: 300, recurringMonthlyTotal: 300, cleanupTotal: 900,
      onboardingFee: 560, oneTimeTotal: 860, amountDueNow: 860,
      chargeKind: "onboarding_and_first_month", selectionHash: "legacy-hash",
      paymentScheduleVersion: 2, cleanupMonths: 3, cleanupMonthlyRate: 300,
      additionalOneTimeTotal: 0, prepaidMonths: 1, includedServices: [],
    };
    const parsed = parseStoredProposalCheckout(JSON.parse(JSON.stringify(saved)));
    expect(parsed).toEqual(saved);
    expect(parsed).not.toHaveProperty("serviceStartMonth");
  });

  it("drops a malformed stored month but keeps the checkout", () => {
    const built = buildProposalCheckoutSummary({
      ...snapshot,
      assessment: { ...snapshot.assessment, serviceStartMonth: "2026-12" },
    }, { ...sel }, { todayISO: "2026-11-27" });
    const stored = JSON.parse(JSON.stringify(built)) as Record<string, unknown>;
    stored.serviceStartMonth = "October 2026";
    const parsed = parseStoredProposalCheckout(stored);
    expect(parsed?.amountDueNow).toBe(800);
    expect(parsed).not.toHaveProperty("serviceStartMonth");
  });
});

describe("spec 06 checkout credit carry-over", () => {
  const withCredit = (firstPaymentCredit: number, firstPaymentCreditReason?: string) => ({
    ...snapshot,
    assessment: {
      ...snapshot.assessment,
      onboardingFeeOverride: 800,
      firstPaymentCredit,
      ...(firstPaymentCreditReason !== undefined ? { firstPaymentCreditReason } : {}),
    },
  });

  it("stores the remainder plus both reasons when the credit exceeds today's amount", () => {
    // $800 onboarding + $300 monthly = $1,100 due; $1,500 credit leaves $400.
    const result = buildProposalCheckoutSummary(
      withCredit(1500, "Credit for October work already paid"), { ...sel },
    );
    expect(result.amountDueBeforeCredit).toBe(1100);
    expect(result.creditApplied).toBe(1100);
    expect(result.amountDueNow).toBe(0);
    expect(result.creditRemaining).toBe(400);
    expect(result.creditRemainingReason).toBe("Credit for October work already paid");
    expect(result.firstPaymentCreditReason).toBe("Credit for October work already paid");
    expect(parseStoredProposalCheckout(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });

  it("stores the reason without carry-over keys when the credit only covers today's amount", () => {
    const exact = buildProposalCheckoutSummary(withCredit(1100, "Credit"), { ...sel });
    expect(exact.amountDueNow).toBe(0);
    expect(exact).not.toHaveProperty("creditRemaining");
    // The reason rides along even with no remainder, so a later waiver keeps it.
    expect(exact.firstPaymentCreditReason).toBe("Credit");
    const under = buildProposalCheckoutSummary(withCredit(300, "Credit"), { ...sel });
    expect(under.amountDueNow).toBe(800);
    expect(under.creditApplied).toBe(300);
    expect(under).not.toHaveProperty("creditRemaining");
    expect(under.firstPaymentCreditReason).toBe("Credit");
    expect(parseStoredProposalCheckout(JSON.parse(JSON.stringify(under)))).toEqual(under);
  });

  it("stores no reason key when the credit has no reason", () => {
    const exact = buildProposalCheckoutSummary(withCredit(1100), { ...sel });
    expect(exact.amountDueNow).toBe(0);
    expect(exact).not.toHaveProperty("firstPaymentCreditReason");
  });

  it("stores the remainder without a reason key when no reason was given", () => {
    const result = buildProposalCheckoutSummary(withCredit(1500), { ...sel });
    expect(result.creditRemaining).toBe(400);
    expect(result.creditRemainingReason).toBe("");
    expect(result).not.toHaveProperty("firstPaymentCreditReason");
    expect(parseStoredProposalCheckout(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });

  it("grows the carry-over when a later waiver shrinks today's amount", () => {
    const built = buildProposalCheckoutSummary(withCredit(1000, "Credit"), { ...sel });
    // $1,100 due, $1,000 credit: $100 due, no remainder yet — but the reason
    // is already stored, so the waiver-created remainder keeps it.
    expect(built.amountDueNow).toBe(100);
    expect(built).not.toHaveProperty("creditRemaining");
    expect(built.firstPaymentCreditReason).toBe("Credit");
    const waived = applyOnboardingWaiver(built);
    expect(waived.amountDueBeforeCredit).toBe(300);
    expect(waived.creditApplied).toBe(300);
    expect(waived.amountDueNow).toBe(0);
    expect(waived.creditRemaining).toBe(700);
    expect(waived.creditRemainingReason).toBe("Credit");
    expect(waived.firstPaymentCreditReason).toBe("Credit");
    expect(parseStoredProposalCheckout(JSON.parse(JSON.stringify(waived)))).toEqual(waived);
  });

  it("waives a reason-free credit with an empty reason rather than dropping the amount", () => {
    const built = buildProposalCheckoutSummary(withCredit(1000), { ...sel });
    expect(built).not.toHaveProperty("firstPaymentCreditReason");
    const waived = applyOnboardingWaiver(built);
    expect(waived.creditRemaining).toBe(700);
    expect(waived.creditRemainingReason).toBe("");
    expect(waived).not.toHaveProperty("firstPaymentCreditReason");
    expect(parseStoredProposalCheckout(JSON.parse(JSON.stringify(waived)))).toEqual(waived);
  });

  it("keeps the stored reasons when a waiver grows an existing remainder", () => {
    const built = buildProposalCheckoutSummary(withCredit(1500, "Credit"), { ...sel });
    expect(built.creditRemaining).toBe(400);
    const waived = applyOnboardingWaiver(built);
    expect(waived.creditRemaining).toBe(1200);
    expect(waived.creditRemainingReason).toBe("Credit");
    expect(waived.firstPaymentCreditReason).toBe("Credit");
    expect(waived.amountDueNow).toBe(0);
    expect(parseStoredProposalCheckout(JSON.parse(JSON.stringify(waived)))).toEqual(waived);
  });

  it("drops a malformed stored remainder but keeps the checkout", () => {
    const built = buildProposalCheckoutSummary(withCredit(1500, "Credit"), { ...sel });
    const stored = JSON.parse(JSON.stringify(built)) as Record<string, unknown>;
    stored.creditRemaining = -50;
    const parsed = parseStoredProposalCheckout(stored);
    expect(parsed?.amountDueNow).toBe(0);
    expect(parsed).not.toHaveProperty("creditRemaining");
  });

  it("leaves legacy stored checkouts without carry-over keys untouched", () => {
    const saved = {
      tier: "maintain", tierLabel: "Maintain", hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: [] as string[], selectedAdditionalOptionIds: [] as string[],
      baseMonthlyTotal: 300, recurringMonthlyTotal: 300, cleanupTotal: 0,
      onboardingFee: 500, oneTimeTotal: 800, amountDueNow: 0,
      amountDueBeforeCredit: 800, creditApplied: 800,
      chargeKind: "onboarding_and_first_month", selectionHash: "legacy-hash",
    };
    expect(parseStoredProposalCheckout(saved)).toEqual(saved);
  });
});

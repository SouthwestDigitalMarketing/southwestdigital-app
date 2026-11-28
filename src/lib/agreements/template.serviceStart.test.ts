import { describe, expect, it } from "vitest";
import { generateProposalAgreementText } from "@/lib/engagements/agreementGenerator";
import { renderAgreementTemplate } from "./template";
import {
  ANNUAL_PREPAID_START_TEXT,
  NO_CLEANUP_MONTHLY_START_TEXT,
} from "@/lib/quotes/paymentSchedule";
import { annualServiceStartText, firstMonthFullText, serviceStartText } from "@/lib/quotes/serviceStart";
import type { CleanupPlan } from "@/lib/quotes/cleanupPlan";

const base = {
  brandName: "Example", clientName: "Client", selectedTierLabel: "Improve",
  paymentScheduleVersion: 2 as const, hasCleanup: false, cleanupMonths: 0,
  cleanupTotal: 0, onboardingFee: 500, recurringMonthlyTotal: 360,
  amountDueNow: 860, agreementTerm: "month-to-month" as const,
  includedServices: [{ name: "Priority Client Support", description: "Same-business-day responses." }],
};

const cleanupPlanFixture: CleanupPlan = {
  caughtUpThrough: "2025-12",
  startDate: "2026-01-05",
  wrapUpDate: "2026-03-05",
  wrapUpSource: "default",
  paymentPlan: "monthly",
};

describe("spec 06 agreement start month and credit carry-over", () => {
  it("replaces the onboarding-confirmation sentence and adds the full-first-month line", () => {
    const text = generateProposalAgreementText({ ...base, serviceStartMonth: "2026-12" });
    expect(text).toContain(serviceStartText("2026-12"));
    expect(text).toContain(firstMonthFullText());
    expect(text).not.toContain("confirm your service start date");
    expect(text).not.toContain(NO_CLEANUP_MONTHLY_START_TEXT);
  });

  it("uses the annual start text on a 12-month term", () => {
    const text = generateProposalAgreementText({
      ...base, serviceStartMonth: "2026-12", agreementTerm: "12-month",
    });
    expect(text).toContain(annualServiceStartText("2026-12"));
    expect(text).toContain(firstMonthFullText());
    expect(text).not.toContain("confirm your service start date");
    expect(text).not.toContain(ANNUAL_PREPAID_START_TEXT);
  });

  it("keeps the wrap-up rule and joins the same month on cleanup (exact wording)", () => {
    const text = generateProposalAgreementText({
      ...base,
      hasCleanup: true, cleanupMonths: 3, cleanupMonthlyRate: 300, cleanupTotal: 900,
      amountDueNow: 560, onboardingFee: 560,
      cleanupPlan: cleanupPlanFixture, monthlyRate: 360,
      serviceStartMonth: "2026-03",
    });
    // The Spec 04 wrap-up rule stays verbatim.
    expect(text).toContain("Monthly service and billing begin on March 5, 2026 or when cleanup is complete, whichever comes first.");
    // The start month line names the wrap-up month — no contradiction.
    expect(text).toContain(serviceStartText("2026-03"));
    expect(text).toContain(firstMonthFullText());
    expect(text).not.toContain("confirm your service start date");
  });

  it("appends the annual start text on cleanup with a 12-month term", () => {
    const text = generateProposalAgreementText({
      ...base,
      hasCleanup: true, cleanupMonths: 3, cleanupMonthlyRate: 300, cleanupTotal: 900,
      amountDueNow: 560, onboardingFee: 560,
      cleanupPlan: cleanupPlanFixture, monthlyRate: 360,
      serviceStartMonth: "2026-03", agreementTerm: "12-month",
    });
    // The annual wrap-up rule stays, joined by the annual month line —
    // never the monthly-billing sentence.
    expect(text).toContain("Your 12 months of service begin on");
    expect(text).toContain(annualServiceStartText("2026-03"));
    expect(text).toContain(firstMonthFullText());
    expect(text).not.toContain("Billing is on the 1st of each month after.");
    expect(text).not.toContain("confirm your service start date");
  });

  it("ignores a stored explicit month on cleanup and names only the wrap-up month", () => {
    const text = generateProposalAgreementText({
      ...base,
      hasCleanup: true, cleanupMonths: 3, cleanupMonthlyRate: 300, cleanupTotal: 900,
      amountDueNow: 560, onboardingFee: 560,
      cleanupPlan: cleanupPlanFixture, monthlyRate: 360,
      serviceStartMonth: "2026-09",
    });
    expect(text).toContain(serviceStartText("2026-03"));
    expect(text).not.toContain("September 1, 2026");
    expect(text).toContain(firstMonthFullText());
  });

  it("shows no month under pre-selection length wording (the relative rule covers the start)", () => {
    const text = generateProposalAgreementText({
      ...base,
      hasCleanup: true, cleanupMonths: 3, cleanupMonthlyRate: 300, cleanupTotal: 900,
      amountDueNow: 560, onboardingFee: 560,
      cleanupPlan: cleanupPlanFixture, monthlyRate: 360,
      wrapUpDateWording: "length",
      serviceStartMonth: "2026-03",
    });
    expect(text).toContain("about 9 weeks after you accept");
    expect(text).not.toContain("Service starts");
    expect(text).not.toContain(firstMonthFullText());
  });

  it("labels the applied credit with the stored reason", () => {
    const text = generateProposalAgreementText({
      ...base, creditApplied: 200, amountDueNow: 660,
      firstPaymentCreditReason: "Credit for October work already paid",
    });
    expect(text).toContain("Credit for October work already paid: -$200.00");
    expect(text).not.toContain("Credit for work already paid: -$200.00");
  });

  it("keeps the default credit label without a reason", () => {
    const text = generateProposalAgreementText({ ...base, creditApplied: 200, amountDueNow: 660 });
    expect(text).toContain("Credit for work already paid: -$200.00");
  });

  it("adds the remainder line only when a remainder exists", () => {
    const withRemainder = generateProposalAgreementText({
      ...base, creditApplied: 860, amountDueNow: 0,
      creditRemaining: 400, creditRemainingReason: "Credit for October work already paid",
    });
    expect(withRemainder).toContain(
      "Remaining credit of $400.00 (Credit for October work already paid) will be applied to your next invoice.",
    );
    const withoutReason = generateProposalAgreementText({
      ...base, creditApplied: 860, amountDueNow: 0, creditRemaining: 400,
    });
    expect(withoutReason).toContain(
      "Remaining credit of $400.00 will be applied to your next invoice.",
    );
    for (const input of [
      {},
      { creditRemaining: 0, creditRemainingReason: "Credit for October work already paid" },
      { creditRemaining: -10 },
    ]) {
      const text = generateProposalAgreementText({ ...base, ...input });
      expect(text).not.toContain("Remaining credit");
    }
  });

  it("renders byte-identical text without a start month or credit reason", () => {
    const baseline = generateProposalAgreementText(base);
    expect(generateProposalAgreementText({ ...base, serviceStartMonth: undefined })).toBe(baseline);
    expect(generateProposalAgreementText({ ...base, serviceStartMonth: null })).toBe(baseline);
    expect(generateProposalAgreementText({ ...base, serviceStartMonth: "soon" })).toBe(baseline);
    expect(generateProposalAgreementText({ ...base, firstPaymentCreditReason: undefined })).toBe(baseline);
    expect(generateProposalAgreementText({ ...base, firstPaymentCreditReason: "" })).toBe(baseline);
    expect(generateProposalAgreementText({ ...base, firstPaymentCreditReason: "   " })).toBe(baseline);
    expect(baseline).not.toContain("Service starts");
    expect(baseline).not.toContain("Remaining credit");
  });

  it("ignores the start month on unstaged (legacy-schedule) agreements", () => {
    const legacy = { ...base, paymentScheduleVersion: undefined, serviceStartMonth: "2026-12" };
    expect(renderAgreementTemplate("Custom {{scopeOfWork}} {{feeStructure}}", legacy)).toBe(
      renderAgreementTemplate("Custom {{scopeOfWork}} {{feeStructure}}", { ...base, paymentScheduleVersion: undefined }),
    );
  });
});

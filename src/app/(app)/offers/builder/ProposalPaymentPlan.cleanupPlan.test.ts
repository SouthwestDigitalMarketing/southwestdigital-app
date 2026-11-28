import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CLEANUP_APPROVAL_TEXT,
  CLEANUP_MONTHLY_START_TEXT,
} from "@/lib/quotes/paymentSchedule";
import ProposalPaymentPlan from "./ProposalPaymentPlan";

const base = {
  cleanupMonths: 5,
  cleanupMonthlyRate: 300,
  onboardingFee: 600,
  recurringMonthlyTotal: 450,
  additionalOneTimeTotal: 0,
  annual: false,
  showStages: true,
};

const plan = {
  caughtUpThrough: "2026-03",
  startDate: "2026-02-14",
  wrapUpDate: "2026-05-14",
  wrapUpSource: "default",
  paymentPlan: "monthly",
} as const;

function render(props: Record<string, unknown>) {
  return renderToStaticMarkup(createElement(ProposalPaymentPlan, { ...base, ...props } as never));
}

describe("spec 04 proposal payment plan", () => {
  it("renders the legacy block without a plan", () => {
    const html = render({});
    expect(html).toContain("Estimated cleanup — later");
    expect(html).toContain(CLEANUP_MONTHLY_START_TEXT);
    expect(html).toContain(CLEANUP_APPROVAL_TEXT);
    expect(html).not.toContain("caught up through");
    expect(html).not.toContain("whichever comes first");
    expect(html).not.toContain("installment");
    expect(html).not.toContain("wrap-up date");
  });

  it("renders no-cleanup copy unchanged", () => {
    const html = render({ cleanupMonths: 0, cleanupPlan: plan });
    // Static markup escapes the apostrophe in NO_CLEANUP_MONTHLY_START_TEXT.
    expect(html).toContain("includes your first month");
    expect(html).toContain("the next monthly payment is due one month after that date");
    expect(html).not.toContain("Estimated cleanup");
    expect(html).not.toContain("caught up through");
  });

  it("renders wrap-up, start rule, payment plan, and installments with a plan", () => {
    const html = render({ cleanupPlan: plan, brandName: "Southwest" });
    expect(html).toContain("We will have your books caught up through March 2026 by May 14, 2026.");
    expect(html).toContain("Monthly service and billing begin on May 14, 2026 or when cleanup is complete, whichever comes first.");
    expect(html).toContain("Cleanup is paid in 3 monthly installments of $500.00.");
    expect(html).toContain("Cleanup installment 1 of 3");
    expect(html).toContain("If cleanup runs past the wrap-up date");
    expect(html).toContain("Southwest");
    expect(html).not.toContain(CLEANUP_MONTHLY_START_TEXT);
  });

  it("uses frozen installments when the stored checkout passes them", () => {
    const html = render({
      cleanupPlan: plan,
      cleanupInstallments: [
        { label: "Cleanup payment 1 of 2 — due at approval", amountCents: 75000, due: "at-approval" },
        { label: "Cleanup payment 2 of 2 — due at completion", amountCents: 75000, due: "at-completion" },
      ],
    });
    expect(html).toContain("Cleanup payment 1 of 2 — due at approval");
    expect(html).toContain("Cleanup payment 2 of 2 — due at completion");
    expect(html).not.toContain("Cleanup installment 1 of 3");
  });

  it("renders the 12-month start rule with a plan on the annual term", () => {
    const html = render({ cleanupPlan: plan, annual: true });
    expect(html).toContain("Your 12 months of service begin on May 14, 2026 or when cleanup is complete, whichever comes first.");
  });

  it("itemizes the complexity add so the equation adds up to the installments", () => {
    const html = render({
      cleanupPlan: plan,
      cleanupInstallments: [
        { label: "Cleanup installment 1 of 3", amountCents: 60833, due: "monthly" },
        { label: "Cleanup installment 2 of 3", amountCents: 60833, due: "monthly" },
        { label: "Cleanup installment 3 of 3", amountCents: 60834, due: "monthly" },
      ],
      complexityCleanupAdd: 325,
    });
    // 5 months × $300 = $1,500 base + $325 add = $1,825 frozen schedule.
    expect(html).toContain("5 months × $300.00/month = <strong>$1,500.00</strong>");
    expect(html).toContain("Complexity adjustment: $325.00");
    expect(html).toContain("Estimated cleanup total: <strong>$1,825.00</strong>");
  });

  it("renders the base-only equation unchanged without an add", () => {
    const html = render({ cleanupPlan: plan });
    expect(html).toContain("5 months × $300.00/month = <strong>$1,500.00</strong>");
    expect(html).not.toContain("Complexity adjustment");
    expect(html).not.toContain("Estimated cleanup total");
  });

  it("cuts fallback installments from the estimate plus the complexity add", () => {
    // No frozen installments passed: the fallback covers the whole displayed
    // estimate (5 × $300 base + $325 add = $1,825), not the base alone.
    const html = render({ cleanupPlan: plan, complexityCleanupAdd: 325 });
    expect(html).toContain("5 months × $300.00/month = <strong>$1,500.00</strong>");
    expect(html).toContain("Complexity adjustment: $325.00");
    expect(html).toContain("Estimated cleanup total: <strong>$1,825.00</strong>");
    expect(html).toContain("Cleanup is paid in 3 monthly installments of $608.33, with a final installment of $608.34.");
    expect(html).toContain("Cleanup installment 3 of 3");
    expect(html).toContain("$608.34");
  });

  it("names the $150 fee in the extension clause by default", () => {
    const html = render({ cleanupPlan: plan, brandName: "Southwest" });
    expect(html).toContain("replaces the $150 file-maintenance fee");
  });

  it("uses generic fee wording when the agreement charges no $150 fee", () => {
    const html = render({ cleanupPlan: plan, brandName: "Southwest", mentionFileFee: false });
    expect(html).not.toContain("$150 file-maintenance fee");
    expect(html).toContain("replaces any file-maintenance fee");
    expect(html).toContain("the two are never charged together for the same month");
  });

  it("defers the annual service payment when cleanup is outstanding", () => {
    const html = render({ cleanupPlan: plan, annual: true });
    expect(html).toContain("not due today. Billed when monthly service begins after cleanup is complete.");
    expect(html).not.toContain("paid in full today");
    const noCleanup = render({ cleanupMonths: 0, annual: true });
    expect(noCleanup).toContain("paid in full today");
  });

  it("renders pay-in-full copy with a full plan", () => {
    const html = render({ cleanupPlan: { ...plan, paymentPlan: "full" } });
    expect(html).toContain("Cleanup is paid in full at approval");
  });

  it("shows the cleanup length instead of the calendar date in length mode", () => {
    const html = render({ cleanupPlan: plan, brandName: "Southwest", cleanupLengthWeeks: 13 });
    expect(html).toContain("We will have your books caught up through March 2026 about 13 weeks after you accept.");
    expect(html).toContain("Monthly service and billing begin about 13 weeks after you accept, or when cleanup is complete, whichever comes first.");
    expect(html).toContain("Cleanup is paid in 3 monthly installments of $500.00.");
    expect(html).not.toContain("May 14, 2026");
  });

  it("resolves the same weeks for a placeholder-start public plan", () => {
    const html = render({
      cleanupPlan: { ...plan, startDate: plan.wrapUpDate },
      brandName: "Southwest",
      cleanupLengthWeeks: 13,
    });
    expect(html).toContain("We will have your books caught up through March 2026 about 13 weeks after you accept.");
    expect(html).not.toContain("May 14, 2026");
  });

  it("shows the annual length rule in length mode", () => {
    const html = render({ cleanupPlan: plan, annual: true, cleanupLengthWeeks: 13 });
    expect(html).toContain("Your 12 months of service begin about 13 weeks after you accept, or when cleanup is complete, whichever comes first.");
    expect(html).not.toContain("May 14, 2026");
  });

  it("keeps the exact stored dates without the length prop", () => {
    const html = render({ cleanupPlan: plan, brandName: "Southwest" });
    expect(html).toContain("We will have your books caught up through March 2026 by May 14, 2026.");
    expect(html).not.toContain("after you accept");
  });
});

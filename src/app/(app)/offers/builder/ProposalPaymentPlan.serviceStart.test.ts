import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ANNUAL_PREPAID_START_TEXT,
  NO_CLEANUP_MONTHLY_START_TEXT,
} from "@/lib/quotes/paymentSchedule";
import {
  annualServiceStartText,
  firstMonthFullText,
  serviceStartText,
} from "@/lib/quotes/serviceStart";
import ProposalPaymentPlan from "./ProposalPaymentPlan";

const base = {
  cleanupMonths: 0,
  cleanupMonthlyRate: 300,
  onboardingFee: 600,
  recurringMonthlyTotal: 450,
  additionalOneTimeTotal: 0,
  annual: false,
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

describe("spec 06 proposal payment plan", () => {
  it("replaces the onboarding-confirmation rule and adds the full-first-month line", () => {
    const html = render({ serviceStartMonth: "2026-12" });
    expect(html).toContain(serviceStartText("2026-12"));
    expect(html).toContain(firstMonthFullText());
    expect(html).not.toContain(NO_CLEANUP_MONTHLY_START_TEXT);
  });

  it("uses the annual start text on a 12-month term", () => {
    const html = render({ serviceStartMonth: "2026-12", annual: true });
    expect(html).toContain(annualServiceStartText("2026-12"));
    expect(html).toContain(firstMonthFullText());
    expect(html).not.toContain(ANNUAL_PREPAID_START_TEXT);
  });

  it("renders byte-identical output without a start month", () => {
    const baseline = render({});
    expect(render({ serviceStartMonth: undefined })).toBe(baseline);
    expect(render({ serviceStartMonth: null })).toBe(baseline);
    expect(render({ serviceStartMonth: "soon" })).toBe(baseline);
    expect(baseline).not.toContain("Service starts");
    expect(baseline).not.toContain("Remaining credit");
  });

  it("keeps the wrap-up rule and joins the same month on cleanup (exact dates)", () => {
    const html = render({
      cleanupMonths: 5, serviceStartMonth: "2026-05", cleanupPlan: plan,
    });
    expect(html).toContain("Monthly service and billing begin on May 14, 2026");
    expect(html).toContain(serviceStartText("2026-05"));
    expect(html).toContain(firstMonthFullText());
  });

  it("shows no month under pre-selection length wording", () => {
    const html = render({
      cleanupMonths: 5, serviceStartMonth: "2026-05", cleanupPlan: plan,
      cleanupIsEstimate: true, cleanupLengthWeeks: 13,
    });
    expect(html).toContain("about 13 weeks after you accept");
    expect(html).not.toContain("Service starts");
    expect(html).not.toContain(firstMonthFullText());
  });

  it("shows the remainder line only when a remainder exists", () => {
    const html = render({
      creditApplied: 100, creditLabel: "Credit for October",
      creditRemaining: 400, creditRemainingReason: "Credit for October",
    });
    expect(html).toContain("Credit for October");
    expect(html).toContain(
      "Remaining credit of $400.00 (Credit for October) will be applied to your next invoice.",
    );
    expect(render({})).not.toContain("Remaining credit");
    expect(render({ creditRemaining: 0, creditRemainingReason: "Credit for October" })).not.toContain(
      "Remaining credit",
    );
  });
});

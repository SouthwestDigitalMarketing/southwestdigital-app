import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE,
  renderAgreementTemplate,
} from "./template";

describe("renderAgreementTemplate", () => {
  const stagedInput = {
    brandName: "Example", clientName: "Client", selectedTierLabel: "Improve",
    paymentScheduleVersion: 2 as const, hasCleanup: true, cleanupMonths: 3,
    cleanupMonthlyRate: 300, cleanupTotal: 900, onboardingFee: 560,
    recurringMonthlyTotal: 360, amountDueNow: 560, agreementTerm: "12-month" as const,
    includedServices: [{ name: "Priority Client Support", description: "Same-business-day responses." }],
  };
  it("separates discovery due today from cleanup estimates and discloses the annual total and start trigger", () => {
    const text = renderAgreementTemplate(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE, stagedInput);
    expect(text).toContain("Onboarding + Discovery");
    expect(text).toContain("3 months × $300.00 = $900.00");
    expect(text).toContain("Total Due Upon Signing: $560.00");
    expect(text).toContain("$360.00 × 12 months = $4,320.00");
    expect(text).toContain("Paid monthly, not in full today");
    expect(text).toContain("written approval before cleanup begins");
    expect(text).toContain("after approved cleanup is complete");
    expect(text).toContain("Priority Client Support: Same-business-day responses.");
    expect(text).not.toContain("Selected Cleanup Work:");
  });
  it("describes the prepaid first month and next billing date when cleanup is unnecessary", () => {
    const text = renderAgreementTemplate(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE, {
      ...stagedInput, hasCleanup: false, cleanupMonths: 0, cleanupTotal: 0,
      onboardingFee: 500, amountDueNow: 860,
    });
    expect(text).toContain("First Month (due today): $360.00");
    expect(text).toContain("Total Due Upon Signing: $860.00");
    expect(text).toContain("next monthly payment is due one month after that date");
    expect(text).not.toContain("Estimated Cleanup");
  });
  it("adds the selected schedule when a custom template omits dynamic fees", () => {
    const text = renderAgreementTemplate("Custom agreement for {{clientName}}", stagedInput);
    expect(text).toContain("Custom agreement for Client");
    expect(text).toContain("SELECTED SERVICES AND PAYMENT SCHEDULE");
    expect(text).toContain("Total Due Upon Signing: $560.00");
  });
  it("renders proposal-specific agreement fields without unresolved supported tokens", () => {
    const rendered = renderAgreementTemplate(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE, {
      brandName: "Southwest Digital Marketing",
      clientName: "Example Holdings LLC",
      primaryContactName: "Taylor Example",
      primaryContactEmail: "taylor@example.com",
      selectedTierLabel: "Growth",
      onboardingFee: 1250,
      hasCleanup: true,
      date: new Date("2026-09-02T12:00:00Z"),
    });

    expect(rendered).toContain("Client:           Example Holdings LLC");
    expect(rendered).toContain("Taylor Example | taylor@example.com");
    expect(rendered).toContain("Growth package");
    expect(rendered).toContain("$1,250.00");
    expect(rendered).toContain("Historical Cleanup + Monthly Bookkeeping");
    expect(rendered).not.toMatch(/{{(?:brandName|clientName|contactLine|date|engagementType|packageName|scopeOfWork|feeStructure)}}/);
  });
});

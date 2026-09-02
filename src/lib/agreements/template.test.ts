import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE,
  renderAgreementTemplate,
} from "./template";

describe("renderAgreementTemplate", () => {
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

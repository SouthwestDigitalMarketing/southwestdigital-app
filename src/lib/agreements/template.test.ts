import { describe, expect, it } from "vitest";
import {
  AGREEMENT_TEMPLATE_TOKENS,
  DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE,
  renderAgreementTemplate,
} from "./template";
import { generateProposalAgreementText } from "@/lib/engagements/agreementGenerator";

describe("renderAgreementTemplate", () => {
  const stagedInput = {
    brandName: "Example", clientName: "Client", selectedTierLabel: "Improve",
    paymentScheduleVersion: 2 as const, hasCleanup: true, cleanupMonths: 3,
    cleanupMonthlyRate: 300, cleanupTotal: 900, onboardingFee: 560,
    recurringMonthlyTotal: 360, amountDueNow: 560, agreementTerm: "12-month" as const,
    includedServices: [{ name: "Priority Client Support", description: "Same-business-day responses." }],
  };

  it.each([
    ["measured", "measured"],
    ["estimated", "partly estimated"],
  ] as const)("renders known volume with %s confidence", (volumeBasis, expectedBasis) => {
    const text = generateProposalAgreementText({ ...stagedInput, volumeMonthlyTotal: 1234, volumeBasis });
    expect(AGREEMENT_TEMPLATE_TOKENS).toContain("{{volumeClause}}");
    expect(text).toContain(`about 1,234 transactions per month across the accounts listed (${expectedBasis})`);
    expect(text).toContain("Example will recheck the average monthly volume");
    expect(text).toContain("About 90 days after work begins, and once a year after that");
    expect(text).toContain("up or down, with 30 days' written notice");
    expect(text).toContain("Adding or closing accounts counts toward the recheck.");
    expect(text).not.toContain("Volume-based pricing. The monthly fee");
    expect(text).not.toContain("{{volumeClause}}");
  });

  it.each([undefined, null])("renders generic wording when volume is %s", (volumeMonthlyTotal) => {
    const text = generateProposalAgreementText({ ...stagedInput, volumeMonthlyTotal });
    expect(text).toContain("13. Volume-Based Pricing\nThe monthly fee is based on the transaction volume across the accounts listed.");
    expect(text).not.toContain("transactions per month");
  });

  it("treats a measured zero as known volume", () => {
    const text = generateProposalAgreementText({ ...stagedInput, volumeMonthlyTotal: 0, volumeBasis: "measured" });
    expect(text).toContain("about 0 transactions per month across the accounts listed (measured)");
  });

  it("inserts volume pricing at 13 and renumbers every later clause through 19", () => {
    const text = generateProposalAgreementText(stagedInput);
    const headings = [...text.matchAll(/^(\d+)\. (.+)$/gm)].map((match) => [Number(match[1]), match[2]]);
    expect(headings.map(([number]) => number)).toEqual(Array.from({ length: 19 }, (_, index) => index + 1));
    expect(headings.slice(11)).toEqual([
      [12, "Service and Price Guarantee"], [13, "Volume-Based Pricing"],
      [14, "Indemnification"], [15, "Limitation of Liability"],
      [16, "Governing Law, Venue, and Attorneys' Fees"], [17, "Entire Agreement"],
      [18, "Severability"], [19, "Electronic Signature"],
    ]);
  });

  it.each([undefined, 2] as const)("appends volume pricing to custom templates (schedule version %s)", (paymentScheduleVersion) => {
    const text = renderAgreementTemplate("Custom agreement for {{clientName}}", { ...stagedInput, paymentScheduleVersion });
    expect(text).toContain("Custom agreement for Client");
    expect(text).toContain("VOLUME-BASED PRICING\n");
    expect(text.match(/The monthly fee is based on/g)).toHaveLength(1);
    expect(text.includes("SELECTED SERVICES AND PAYMENT SCHEDULE")).toBe(paymentScheduleVersion === 2);
  });

  it("renders a custom volume token once without appending a fallback", () => {
    const text = renderAgreementTemplate("Terms\n{{volumeClause}}", { ...stagedInput, paymentScheduleVersion: undefined });
    expect(text).toMatch(/^Terms\nThe monthly fee is based on/);
    expect(text.match(/The monthly fee is based on/g)).toHaveLength(1);
    expect(text).not.toContain("VOLUME-BASED PRICING");
  });

  it("removes the default volume clause and restores contiguous numbering when disabled", () => {
    const text = generateProposalAgreementText({ ...stagedInput, includeVolumeClause: false, volumeMonthlyTotal: 200 });
    expect(text).not.toMatch(/volume|pricing band/i);
    expect(text).toContain("13. Indemnification");
    expect(text).toContain("18. Electronic Signature");
    expect(text).not.toContain("19.");
  });

  it("leaves custom volume headings untouched and empties the token when disabled", () => {
    const template = "Terms\n\n13. Volume-Based Pricing\nCustom volume body {{volumeClause}} end.\n\n14. Indemnification\nBody.";
    const text = renderAgreementTemplate(template, { ...stagedInput, paymentScheduleVersion: undefined, includeVolumeClause: false });
    expect(text).toBe("Terms\n\n13. Volume-Based Pricing\nCustom volume body  end.\n\n14. Indemnification\nBody.");
    expect(text).not.toContain("{{");
  });

  it("keeps the stored default template at clauses 1-18 with no volume token", () => {
    expect(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE).not.toContain("{{volumeClause}}");
    expect(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE).not.toContain("Volume-Based Pricing");
    const headings = [...DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE.matchAll(/^(\d+)\. (.+)$/gm)]
      .map((match) => [Number(match[1]), match[2]] as [number, string]);
    expect(headings).toEqual([
      [1, "Confidentiality"], [2, "Electronic Communications"], [3, "Client Cooperation"],
      [4, "Unanticipated and Out-of-Scope Services"], [5, "Client Responsibilities"],
      [6, "Ownership of Documents"], [7, "Proprietary Materials"],
      [8, "Record Retention and Third-Party Platforms"], [9, "Termination"],
      [10, "Payment Terms and Delinquent Accounts"], [11, "Retainers"],
      [12, "Service and Price Guarantee"], [13, "Indemnification"],
      [14, "Limitation of Liability"], [15, "Governing Law, Venue, and Attorneys' Fees"],
      [16, "Entire Agreement"], [17, "Severability"], [18, "Electronic Signature"],
    ]);
  });

  it("inserts a numbered volume clause after the guarantee clause in custom templates without the token", () => {
    const template = "Terms for {{clientName}}\n\n12. Service and Price Guarantee\nGuarantee body.\n\n13. Indemnification\nIndemnity body.";
    const text = renderAgreementTemplate(template, { ...stagedInput, paymentScheduleVersion: undefined });
    expect(text).toContain("12. Service and Price Guarantee\nGuarantee body.\n\n13. Volume-Based Pricing\nThe monthly fee is based on");
    expect(text).toContain("14. Indemnification\nIndemnity body.");
    expect(text).not.toContain("{{");
  });

  it.each(["Custom {{volumeClause}}", "Custom"])("does not append or render disabled volume pricing in %s", (template) => {
    const text = renderAgreementTemplate(template, {
      ...stagedInput, paymentScheduleVersion: undefined, includeVolumeClause: false,
    });
    expect(text.trim()).toBe("Custom");
  });

  it("lists a required one-time service by name, not as a selected add-on", () => {
    const text = renderAgreementTemplate(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE, {
      ...stagedInput,
      hasCleanup: false, cleanupMonths: 0, cleanupTotal: 0, onboardingFee: 350,
      recurringMonthlyTotal: 450, amountDueNow: 1440,
      additionalOneTimeTotal: 640,
      requiredOneTime: [{ name: "QuickBooks Desktop to Online Migration", price: 640 }],
    });
    expect(text).toContain("QuickBooks Desktop to Online Migration (due today): $640.00");
    expect(text).not.toContain("Selected One-Time Add-ons");
  });
  it("separates discovery due today from cleanup estimates and discloses the annual total and start trigger", () => {
    const text = renderAgreementTemplate(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE, stagedInput);
    expect(text).toContain("Onboarding + Discovery");
    expect(text).toContain("3 months × $300.00 = $900.00");
    expect(text).toContain("Total Due Upon Signing: $560.00");
    expect(text).toContain("$360.00 × 12 months = $4,320.00");
    expect(text).toContain("Paid in full today at the discounted annual rate");
    expect(text).toContain("written approval before cleanup begins");
    expect(text).toContain("after approved cleanup is complete");
    expect(text).toContain("Priority Client Support: Same-business-day responses.");
    expect(text).not.toContain("Selected Cleanup Work:");
  });
  it("describes the prepaid first month and next billing date when cleanup is unnecessary", () => {
    const text = renderAgreementTemplate(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE, {
      ...stagedInput, hasCleanup: false, cleanupMonths: 0, cleanupTotal: 0,
      onboardingFee: 500, amountDueNow: 860, agreementTerm: "month-to-month" as const,
    });
    expect(text).toContain("First Month (due today): $360.00");
    expect(text).toContain("Total Due Upon Signing: $860.00");
    expect(text).toContain("next monthly payment is due one month after that date");
    expect(text).not.toContain("Estimated Cleanup");
  });
  it("charges and describes the whole year when the term is twelve months", () => {
    const text = renderAgreementTemplate(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE, {
      ...stagedInput, hasCleanup: false, cleanupMonths: 0, cleanupTotal: 0,
      onboardingFee: 500, amountDueNow: 4820,
    });
    expect(text).toContain("12 Months of Service (due today): $360.00 \u00d7 12 = $4,320.00");
    expect(text).toContain("Total Due Upon Signing: $4,820.00");
    expect(text).toContain("covers your first 12 months of service in full");
    expect(text).not.toContain("First Month (due today)");
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
    expect(rendered).not.toMatch(/{{(?:brandName|clientName|contactLine|date|engagementType|packageName|scopeOfWork|feeStructure|volumeClause)}}/);
  });
});

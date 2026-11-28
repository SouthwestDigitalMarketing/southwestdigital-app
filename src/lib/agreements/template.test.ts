import { describe, expect, it } from "vitest";
import {
  AGREEMENT_TEMPLATE_TOKENS,
  DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE,
  renderAgreementTemplate,
} from "./template";
import { generateProposalAgreementText } from "@/lib/engagements/agreementGenerator";
import {
  companyBundleFeeLines,
  DEFAULT_BUNDLE_PRICING_OPTIONS,
  priceCompanyBundle,
} from "@/lib/quotes/companyBundle";
import { FILE_MAINTENANCE_NO_STACKING_SENTENCE, agreementMentionsFileFee } from "./template";
import type { CleanupInstallment, CleanupPlan } from "@/lib/quotes/cleanupPlan";

describe("renderAgreementTemplate", () => {
  const stagedInput = {
    brandName: "Example", clientName: "Client", selectedTierLabel: "Improve",
    paymentScheduleVersion: 2 as const, hasCleanup: true, cleanupMonths: 3,
    cleanupMonthlyRate: 300, cleanupTotal: 900, onboardingFee: 560,
    recurringMonthlyTotal: 360, amountDueNow: 560, agreementTerm: "12-month" as const,
    includedServices: [{ name: "Priority Client Support", description: "Same-business-day responses." }],
  };

  /** Sum of the fee lines due today: onboarding + one-time/setup/add-on lines + service due now − credit. */
  function dueTodayTotal(text: string): number {
    const section = text.slice(text.indexOf("FEE STRUCTURE"));
    const amount = (line: string, pattern: RegExp): number => {
      const match = pattern.exec(line);
      return match ? Number(match[1].replace(/,/g, "")) : 0;
    };
    let total = 0;
    for (const line of section.split("\n")) {
      if (/^Total Due Upon Signing/.test(line)) continue;
      if (line.startsWith("Credit for work already paid: -$")) {
        total -= amount(line, /-\$([\d,]+\.\d{2})/);
        continue;
      }
      if (line.startsWith("12 Months of Service (due today)")) {
        total += amount(line, /= \$([\d,]+\.\d{2})/);
        continue;
      }
      if (/\(due today\): \$/.test(line)) {
        total += amount(line, /\(due today\): \$([\d,]+\.\d{2})/);
        continue;
      }
      if (/: \$[\d,]+\.\d{2} \(one-time\)/.test(line)) {
        total += amount(line, /: \$([\d,]+\.\d{2}) \(one-time\)/);
        continue;
      }
      const onboarding = /^(?:Onboarding Fee|Onboarding \+ Discovery):\s+(Waived|\$[\d,]+\.\d{2})/.exec(line);
      if (onboarding && onboarding[1] !== "Waived") total += Number(onboarding[1].slice(1).replace(/,/g, ""));
    }
    return Math.round(total * 100) / 100;
  }

  function totalDue(text: string): number {
    const match = /Total Due Upon Signing: \$([\d,]+\.\d{2})/.exec(text);
    return match ? Number(match[1].replace(/,/g, "")) : Number.NaN;
  }

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

  it("itemizes the complexity cleanup add so the estimate equation adds up", () => {
    const text = generateProposalAgreementText({
      ...stagedInput, cleanupTotal: 1095, complexityCleanupAdd: 195,
    });
    expect(text).toContain("Estimated Cleanup (not due today): 3 months × $300.00 = $900.00");
    expect(text).toContain("Complexity adjustment: $195.00");
    expect(text).toContain("Estimated Cleanup Total: $1,095.00");
  });

  it("renders the cleanup equation without complexity lines when the add is absent", () => {
    for (const complexityCleanupAdd of [undefined, 0, null] as const) {
      const text = generateProposalAgreementText({ ...stagedInput, complexityCleanupAdd });
      expect(text).toContain("Estimated Cleanup (not due today): 3 months × $300.00 = $900.00");
      expect(text).not.toContain("Complexity adjustment");
      expect(text).not.toContain("Estimated Cleanup Total");
    }
  });

  it("detects the $150 file-maintenance fee the same way the renderer does", () => {
    expect(agreementMentionsFileFee(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE)).toBe(true);
    expect(agreementMentionsFileFee("Custom terms with no maintenance fee.")).toBe(false);
    expect(agreementMentionsFileFee("")).toBe(false);
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
    // Cleanup is outstanding: no service is paid in full today.
    expect(text).toContain("Not due today; billed at the discounted annual rate when monthly service begins after cleanup is complete.");
    expect(text).not.toContain("Paid in full today");
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
  it("renders byte-identical text when companyFeeLines is absent or empty", () => {
    const without = renderAgreementTemplate(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE, stagedInput);
    expect(renderAgreementTemplate(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE, { ...stagedInput, companyFeeLines: [] })).toBe(without);
    expect(renderAgreementTemplate(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE, { ...stagedInput, companyFeeLines: undefined })).toBe(without);
    expect(without).not.toContain("bundle");
  });

  it("lists one fee line per company plus locations and setup lines with the bundle monthly total", () => {
    const priced = priceCompanyBundle({
      companies: [
        { id: "main", name: "Main Co", ownQboFile: true, fileStatus: "existing", locationsCount: 2, propertiesCount: 0, accounts: [], complexity: null },
        { id: "beta", name: "Beta", ownQboFile: true, fileStatus: "new_file", locationsCount: 0, propertiesCount: 0, accounts: [], complexity: null },
      ],
      packageId: "maintain",
      baseAssessment: {},
      options: DEFAULT_BUNDLE_PRICING_OPTIONS,
    });
    const feeLines = companyBundleFeeLines(priced);
    const text = renderAgreementTemplate(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE, {
      ...stagedInput,
      companyFeeLines: feeLines,
    });
    expect(text).toContain("Main Co — monthly bookkeeping: $250.00 per month");
    expect(text).toContain("Beta — monthly bookkeeping (bundle, 20% off): $200.00 per month");
    expect(text).toContain("Beta — new QuickBooks file setup: $150.00 (one-time)");
    expect(text).toContain("Locations — location reporting: $50.00 per month");
    expect(text).toContain(`Ongoing Monthly Services: $${priced.bundleMonthly.toFixed(2)} per month`);
    expect(priced.bundleMonthly).toBe(500);
  });

  it("groups fee lines by kind even when labels mislead (F6)", () => {
    const text = renderAgreementTemplate(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE, {
      ...stagedInput,
      companyFeeLines: [
        { companyName: "X", kind: "company-monthly", label: "Not really a monthly line", amount: 100, cadence: "one-time" },
        { companyName: "Y", kind: "setup", label: "Not really a one-time line", amount: 50, cadence: "monthly" },
      ],
    });
    expect(text).toContain("Ongoing Monthly Services: $100.00 per month");
    expect(text).toContain("Not really a one-time line: $50.00 (one-time)");
  });

  it("lists bundle setup exactly once so the itemized due-today lines sum to the total", () => {
    const priced = priceCompanyBundle({
      companies: [
        { id: "main", name: "Main Co", ownQboFile: true, fileStatus: "existing", locationsCount: 0, propertiesCount: 0, accounts: [], complexity: null },
        { id: "beta", name: "Beta", ownQboFile: true, fileStatus: "new_file", locationsCount: 0, propertiesCount: 0, accounts: [], complexity: null },
      ],
      packageId: "maintain",
      baseAssessment: {},
      options: DEFAULT_BUNDLE_PRICING_OPTIONS,
    });
    const setup = priced.setupTotal;
    expect(setup).toBe(150);
    const text = renderAgreementTemplate(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE, {
      ...stagedInput,
      hasCleanup: false, cleanupMonths: 0, cleanupTotal: 0,
      agreementTerm: "month-to-month" as const,
      onboardingFee: 500,
      recurringMonthlyTotal: priced.bundleMonthly,
      additionalOneTimeTotal: setup,
      requiredOneTime: [],
      companyFeeLines: companyBundleFeeLines(priced),
      amountDueNow: 500 + setup + priced.bundleMonthly,
    });
    expect(text.match(/new QuickBooks file setup/g) ?? []).toHaveLength(1);
    expect(text).not.toContain("Selected One-Time Add-ons");
    expect(dueTodayTotal(text)).toBe(totalDue(text));
    expect(totalDue(text)).toBe(500 + setup + priced.bundleMonthly);
  });

  it("keeps a non-setup add-on on the add-ons line while setup stays on its own line", () => {
    const priced = priceCompanyBundle({
      companies: [
        { id: "main", name: "Main Co", ownQboFile: true, fileStatus: "existing", locationsCount: 0, propertiesCount: 0, accounts: [], complexity: null },
        { id: "beta", name: "Beta", ownQboFile: true, fileStatus: "new_file", locationsCount: 0, propertiesCount: 0, accounts: [], complexity: null },
      ],
      packageId: "maintain",
      baseAssessment: {},
      options: DEFAULT_BUNDLE_PRICING_OPTIONS,
    });
    const text = renderAgreementTemplate(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE, {
      ...stagedInput,
      hasCleanup: false, cleanupMonths: 0, cleanupTotal: 0,
      agreementTerm: "month-to-month" as const,
      onboardingFee: 500,
      recurringMonthlyTotal: priced.bundleMonthly,
      additionalOneTimeTotal: priced.setupTotal + 200,
      requiredOneTime: [],
      companyFeeLines: companyBundleFeeLines(priced),
      amountDueNow: 500 + priced.setupTotal + 200 + priced.bundleMonthly,
    });
    expect(text.match(/new QuickBooks file setup/g) ?? []).toHaveLength(1);
    expect(text).toContain("Selected One-Time Add-ons (due today): $200.00");
    expect(dueTodayTotal(text)).toBe(totalDue(text));
  });

  it("sums legacy due-today lines to the total with required and selected add-ons", () => {
    const text = renderAgreementTemplate(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE, {
      ...stagedInput,
      hasCleanup: false, cleanupMonths: 0, cleanupTotal: 0,
      agreementTerm: "month-to-month" as const,
      onboardingFee: 350,
      recurringMonthlyTotal: 450,
      additionalOneTimeTotal: 840,
      requiredOneTime: [{ name: "QuickBooks Desktop to Online Migration", price: 640 }],
      amountDueNow: 1640,
    });
    expect(text).toContain("QuickBooks Desktop to Online Migration (due today): $640.00");
    expect(text).toContain("Selected One-Time Add-ons (due today): $200.00");
    expect(dueTodayTotal(text)).toBe(totalDue(text));
    expect(totalDue(text)).toBe(1640);
  });

  describe("Spec 04 cleanup plan", () => {
    const cleanupPlanFixture: CleanupPlan = {
      caughtUpThrough: "2025-12",
      startDate: "2026-01-05",
      wrapUpDate: "2026-03-05",
      wrapUpSource: "default",
      paymentPlan: "monthly",
    };
    const withPlan = {
      ...stagedInput,
      cleanupPlan: cleanupPlanFixture,
      monthlyRate: 360,
    };

    function headings(text: string): Array<[number, string]> {
      return [...text.matchAll(/^(\d+)\. (.+)$/gm)].map((match) => [Number(match[1]), match[2]] as [number, string]);
    }

    it("inserts the wrap-up clause after volume pricing and renumbers through 20", () => {
      const text = generateProposalAgreementText(withPlan);
      expect(headings(text).map(([number]) => number)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
      expect(headings(text).slice(11)).toEqual([
        [12, "Service and Price Guarantee"], [13, "Volume-Based Pricing"],
        [14, "Cleanup Wrap-Up and Extension"], [15, "Indemnification"],
        [16, "Limitation of Liability"], [17, "Governing Law, Venue, and Attorneys' Fees"],
        [18, "Entire Agreement"], [19, "Severability"], [20, "Electronic Signature"],
      ]);
      expect(text).toContain("We will have your books caught up through December 2025 by March 5, 2026.");
      expect(text).toContain("currently $360");
      expect(text).toContain("the two are never charged together for the same month");
      expect(text).toContain("there is no extra charge and the wrap-up date moves");
    });

    it("inserts the wrap-up clause at 13 when the volume clause is disabled", () => {
      const text = generateProposalAgreementText({ ...withPlan, includeVolumeClause: false });
      expect(headings(text).map(([number]) => number)).toEqual(Array.from({ length: 19 }, (_, index) => index + 1));
      expect(headings(text).slice(11)).toEqual([
        [12, "Service and Price Guarantee"], [13, "Cleanup Wrap-Up and Extension"],
        [14, "Indemnification"], [15, "Limitation of Liability"],
        [16, "Governing Law, Venue, and Attorneys' Fees"], [17, "Entire Agreement"],
        [18, "Severability"], [19, "Electronic Signature"],
      ]);
      expect(text).not.toMatch(/volume|pricing band/i);
    });

    it("inserts the wrap-up clause after a custom numbered volume heading", () => {
      const template = "Terms for {{clientName}}\n\n12. Service and Price Guarantee\nGuarantee body.\n\n13. Indemnification\nIndemnity body.";
      const text = renderAgreementTemplate(template, { ...withPlan, paymentScheduleVersion: undefined, includeVolumeClause: false });
      expect(text).toContain("12. Service and Price Guarantee\nGuarantee body.\n\n13. Cleanup Wrap-Up and Extension\nWe will have your books caught up");
      expect(text).toContain("14. Indemnification\nIndemnity body.");
    });

    it("names the payment plan on the fee line and uses the wrap-up start rule in scope", () => {
      const text = generateProposalAgreementText(withPlan);
      expect(text).toContain("Estimated Cleanup (not due today): 3 months × $300.00 = $900.00. Cleanup is paid in 2 monthly installments of $450.00.");
      expect(text).toContain("Your 12 months of service begin on March 5, 2026 or when cleanup is complete, whichever comes first.");
      const monthly = generateProposalAgreementText({ ...withPlan, agreementTerm: "month-to-month" });
      expect(monthly).toContain("Monthly service and billing begin on March 5, 2026 or when cleanup is complete, whichever comes first.");
      expect(monthly).not.toContain("12 months of service begin");
    });

    it("shows the cleanup length instead of the wrap-up date in length wording", () => {
      // Jan 5 -> Mar 5 is 59 days, rounded up to whole weeks.
      const text = generateProposalAgreementText({ ...withPlan, wrapUpDateWording: "length" });
      expect(text).toContain("We will have your books caught up through December 2025 about 9 weeks after you accept.");
      expect(text).toContain("Your 12 months of service begin about 9 weeks after you accept, or when cleanup is complete, whichever comes first.");
      const monthly = generateProposalAgreementText({ ...withPlan, wrapUpDateWording: "length", agreementTerm: "month-to-month" });
      expect(monthly).toContain("Monthly service and billing begin about 9 weeks after you accept, or when cleanup is complete, whichever comes first.");
      expect(monthly).not.toContain("March 5, 2026");
      expect(text).toContain("If cleanup runs past the wrap-up date");
    });

    it("derives installments from the plan when stored installments are absent", () => {
      const text = generateProposalAgreementText({ ...withPlan, cleanupInstallments: undefined });
      expect(text).toContain("Cleanup is paid in 2 monthly installments of $450.00.");
      expect(text).toContain("14. Cleanup Wrap-Up and Extension");
    });

    it("prefers stored installments over derived ones", () => {
      const stored: CleanupInstallment[] = [
        { label: "Cleanup payment in full", amountCents: 90000, due: "at-approval", dueDate: "2026-01-05" },
      ];
      const text = generateProposalAgreementText({
        ...withPlan,
        cleanupPlan: { ...cleanupPlanFixture, paymentPlan: "full" },
        cleanupInstallments: stored,
      });
      expect(text).toContain("Cleanup is paid in full at approval: $900.00 due when cleanup is approved.");
    });

    it("appends the no-stacking sentence to the $150 bullet only with a plan", () => {
      const text = generateProposalAgreementText(withPlan);
      expect(text).toContain(`$150/month file-maintenance fee applies to keep the engagement open. ${FILE_MAINTENANCE_NO_STACKING_SENTENCE}`);
      const legacy = generateProposalAgreementText(stagedInput);
      expect(legacy).toContain("$150/month file-maintenance fee applies to keep the engagement open.");
      expect(legacy).not.toContain(FILE_MAINTENANCE_NO_STACKING_SENTENCE);
      expect(legacy).not.toContain("Wrap-Up");
    });

    it("itemizes the complexity cleanup add so the fee equation adds up", () => {
      const text = generateProposalAgreementText({ ...withPlan, cleanupTotal: 1095, complexityCleanupAdd: 195 });
      expect(text).toContain("Estimated Cleanup (not due today): 3 months × $300.00 = $900.00.");
      expect(text).toContain("Complexity adjustment: $195.00");
      expect(text).toContain("Estimated Cleanup Total: $1,095.00");
      // Without the add the fee line renders exactly as before.
      expect(generateProposalAgreementText(withPlan)).toContain("3 months × $300.00 = $900.00. Cleanup is paid in");
      expect(generateProposalAgreementText(withPlan)).not.toContain("Complexity adjustment");
    });

    it("uses deferred annual wording only when cleanup is outstanding", () => {
      const annual = generateProposalAgreementText({ ...withPlan, agreementTerm: "12-month" });
      expect(annual).toContain("Not due today; billed at the discounted annual rate");
      expect(annual).not.toContain("Paid in full today");
      const noCleanup = generateProposalAgreementText({
        ...stagedInput, hasCleanup: false, cleanupMonths: 0, cleanupTotal: 0, agreementTerm: "12-month",
      });
      expect(noCleanup).toContain("Paid in full today at the discounted annual rate");
    });

    it("names the $150 fee in the extension clause only for templates that charge it", () => {
      const text = generateProposalAgreementText(withPlan);
      expect(text).toContain("replaces the $150 file-maintenance fee");
      const custom = renderAgreementTemplate("Custom agreement for {{clientName}}", withPlan);
      expect(custom).toContain("replaces any file-maintenance fee for that month");
      expect(custom).not.toContain("$150");
    });

    it("renders byte-identical text when the plan is absent, null, or junk", () => {
      const baseline = generateProposalAgreementText(stagedInput);
      expect(generateProposalAgreementText({ ...stagedInput, cleanupPlan: undefined })).toBe(baseline);
      expect(generateProposalAgreementText({ ...stagedInput, cleanupPlan: null })).toBe(baseline);
      expect(generateProposalAgreementText({
        ...stagedInput,
        cleanupPlan: { bogus: true } as unknown as CleanupPlan,
        cleanupInstallments: ["nope"] as unknown as CleanupInstallment[],
      })).toBe(baseline);
      expect(generateProposalAgreementText({ ...stagedInput, hasCleanup: false, cleanupPlan: cleanupPlanFixture })).toBe(
        generateProposalAgreementText({ ...stagedInput, hasCleanup: false }),
      );
    });

    it("appends the cleanup block to custom templates without numbered headings", () => {
      const text = renderAgreementTemplate("Custom agreement for {{clientName}}", withPlan);
      expect(text).toContain("VOLUME-BASED PRICING");
      expect(text).toContain("CLEANUP WRAP-UP AND EXTENSION");
      expect(text).toContain("We will have your books caught up through December 2025 by March 5, 2026.");
      expect(text).toContain("If the delay is caused by Example, there is no extra charge");
      // Volume fallback first (inserted after the guarantee rule finds no
      // headings), then the cleanup block appended after it.
      expect(text.indexOf("VOLUME-BASED PRICING")).toBeLessThan(text.indexOf("CLEANUP WRAP-UP AND EXTENSION"));
    });

    it("appends the cleanup block when the volume clause renders inline from a token", () => {
      const text = renderAgreementTemplate("Terms\n{{volumeClause}}", { ...withPlan, paymentScheduleVersion: undefined });
      expect(text).toMatch(/^Terms\nThe monthly fee is based on/);
      expect(text).toContain("CLEANUP WRAP-UP AND EXTENSION");
    });
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

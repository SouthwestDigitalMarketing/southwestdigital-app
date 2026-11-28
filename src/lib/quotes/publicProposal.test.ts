import { describe, expect, it } from "vitest";
import {
  catalogCopyFromRows,
  toPublicBookkeepingProposal,
  toPublicHourlyProposal,
} from "./publicProposal";
import { buildCompanyBundleSnapshot } from "./companyBundle";

describe("public proposal data boundary", () => {
  const pricing = { maintain: { monthly: 500 }, improve: { monthly: 600 }, grow: { monthly: 750 } };

  it("exposes only whitelisted open-account fields and keeps the assessment private", () => {
    const privateValue = "PRIVATE_ACCOUNT_SENTINEL";
    const result = toPublicBookkeepingProposal({
      assessment: {
        bankAccountsCount: 99, assessmentNotes: privateValue,
        accounts: [
          { id: privateValue, kind: "checking", label: "Chase", last4: "1234", status: "open", monthlyTransactions: 80, basis: "measured", source: privateValue, secret: privateValue },
          { id: "card", kind: "credit_card", label: "Visa", status: "open", monthlyTransactions: 25, basis: "estimated", source: privateValue },
          { id: "closed", kind: "checking", label: privateValue, last4: "9999", status: "closed", monthlyTransactions: 9000, basis: "measured" },
        ],
      },
      pricing,
    });
    expect(result.accountInventory).toEqual({
      accounts: [
        { kind: "checking", kindLabel: "Checking", label: "Chase", last4: "1234", monthlyTransactions: 80, basis: "measured" },
        { kind: "credit_card", kindLabel: "Credit card", label: "Visa", monthlyTransactions: 25, basis: "estimated" },
      ],
      monthlyTotal: 105, basis: "estimated", hasEstimated: true,
    });
    expect(JSON.stringify(result)).not.toContain(privateValue);
    expect(result.assessment).not.toHaveProperty("accounts");
    expect(result.assessment).not.toHaveProperty("bankAccountsCount");
  });

  it.each([
    { accounts: undefined }, { accounts: null }, { accounts: [] },
    { accounts: [{ id: "closed", kind: "checking", status: "closed", monthlyTransactions: 100, basis: "measured" }] },
  ])("returns no public inventory without open accounts ($accounts)", ({ accounts }) => {
    const result = toPublicBookkeepingProposal({ assessment: { accounts }, pricing });
    expect(result.accountInventory).toBeNull();
  });

  it("keeps a legacy snapshot's existing payload and stored data unchanged", () => {
    const snapshot = { assessment: { introHeadline: "Legacy plan", bankAccountsCount: 3 }, pricing };
    const before = structuredClone(snapshot);
    const result = toPublicBookkeepingProposal(snapshot);
    expect(result).toEqual({
      accountInventory: null,
      assessment: { introHeadline: "Legacy plan", historicalCleanupPeriods: [], additionalOptions: [], bonuses: [] },
      pricing,
      companyBundle: null,
      complexityWhy: null,
      complexityWhyByTier: null,
      contactInfo: { companyName: "", owners: [], primaryContact: { firstName: "", lastName: "", email: "", sameAsOwner: false, ownerId: "", phone: "", role: "" } },
    });
    expect(snapshot).toEqual(before);
  });

  it("keeps published prices and excludes internal data at every nesting level", () => {
    const privateValue = "PRIVATE_SENTINEL_DO_NOT_PUBLISH";
    const result = toPublicBookkeepingProposal({
      assessment: {
        assessmentNotes: privateValue, discretionaryMultiplierNote: privateValue,
        packageNames: { grow: "Advisory", improve: "Momentum", maintain: "Essentials" },
        discretionaryMultiplier: 8, payrollContactEmail: privateValue,
        bankAccountsCount: 31, adminAssistantPhone: privateValue,
        introHeadline: "Your bookkeeping plan",
        historicalCleanupPeriods: [{ id: "2025", year: 2025, startMonth: 1, endMonth: 12, secret: privateValue }],
        additionalOptions: [{ id: "reports", name: "Reports", description: "Monthly reporting", monthlyPrice: 50, showInProposal: true, archived: false, applicabilityReason: privateValue }],
        bonuses: [{ id: "included-reports", name: "Reports", description: "Details", archived: false,
          billingCadence: "monthly", includedPlacement: "included", applicabilityReason: privateValue }],
        heroMediaButton: { label: "Watch", icon: "play", iconPlacement: "end", visible: true, secret: privateValue },
      },
      contactInfo: {
        companyName: "Example LLC", invoicingEmail: privateValue,
        primaryContact: { sameAsOwner: true, ownerId: "owner" },
        owners: [{ id: "owner", firstName: "Alex", lastName: "Example", email: "alex@example.test", phone: privateValue, crmContactId: privateValue, ownershipPercentage: privateValue }],
      },
      pricing: { maintain: { monthly: 500, breakdown: privateValue }, improve: { monthly: 600 }, grow: { monthly: 750 }, internal: privateValue },
      internal: privateValue,
    });
    expect(JSON.stringify(result)).not.toContain(privateValue);
    expect(result.assessment).not.toHaveProperty("discretionaryMultiplier");
    expect(result.assessment).not.toHaveProperty("bankAccountsCount");
    expect(result.assessment.packageNames).toEqual({
      grow: "Advisory",
      improve: "Momentum",
      maintain: "Essentials",
    });
    expect(result.assessment.bonuses[0]).toMatchObject({ billingCadence: "monthly", includedPlacement: "included" });
    expect(result.pricing.maintain).toEqual({ monthly: 500 });
    expect(result.contactInfo.primaryContact.email).toBe("alex@example.test");
    expect(result.contactInfo.owners).toEqual([]);
  });

  it("keeps the required flag on public add-ons so checkout can enforce it", () => {
    const result = toPublicBookkeepingProposal({
      assessment: {
        additionalOptions: [
          { id: "migration", name: "Migration", description: "", monthlyPrice: 640, showInProposal: true, archived: false, billingCadence: "one-time", required: true },
        ],
      },
      pricing: { maintain: { monthly: 450 }, improve: { monthly: 550 }, grow: { monthly: 675 } },
    });
    expect(result.assessment.additionalOptions[0].required).toBe(true);
  });

  it("keeps the contract-follows-payment flag so the confirmation page can say a contract is coming", () => {
    const result = toPublicBookkeepingProposal({
      assessment: { contractFollowsPayment: true },
      pricing: { maintain: { monthly: 450 }, improve: { monthly: 550 }, grow: { monthly: 675 } },
    });
    expect(result.assessment.contractFollowsPayment).toBe(true);
  });

  it("does not recalculate missing published prices from internal assessment", () => {
    expect(() => toPublicBookkeepingProposal({ assessment: {}, pricing: {} })).toThrow();
  });

  it("keeps the strikethrough toggle on the public assessment", () => {
    const pricing = { maintain: { monthly: 500 }, improve: { monthly: 600 }, grow: { monthly: 750 } };
    for (const showOriginalOneTimePrices of [true, false]) {
      const result = toPublicBookkeepingProposal({
        assessment: { waiveOnboardingFee: true, onboardingFeeOverride: 540, showOriginalOneTimePrices },
        pricing,
        contactInfo: {},
      });
      expect(result.assessment.showOriginalOneTimePrices).toBe(showOriginalOneTimePrices);
    }
  });

  it("toggling the strikethrough flag off suppresses originalPrice while row.price is unchanged", () => {
    const resolveOriginalPrice = (
      assessment: { showOriginalOneTimePrices?: boolean },
      row: { price: number },
      isOnboardingRow: boolean,
      originalOnboardingFee: number,
    ) =>
      assessment.showOriginalOneTimePrices !== false && isOnboardingRow && originalOnboardingFee > row.price
        ? originalOnboardingFee
        : undefined;
    const row = { price: 0 };
    const originalOnboardingFee = 540;
    expect(resolveOriginalPrice({ showOriginalOneTimePrices: true }, row, true, originalOnboardingFee)).toBe(540);
    expect(resolveOriginalPrice({}, row, true, originalOnboardingFee)).toBe(540);
    expect(resolveOriginalPrice({ showOriginalOneTimePrices: false }, row, true, originalOnboardingFee)).toBeUndefined();
    expect(row.price).toBe(0);
    expect(resolveOriginalPrice({ showOriginalOneTimePrices: true }, row, false, originalOnboardingFee)).toBeUndefined();
    expect(resolveOriginalPrice({ showOriginalOneTimePrices: true }, { price: 540 }, true, originalOnboardingFee)).toBeUndefined();
  });

  it("rejects active content URLs", () => {
    expect(() => toPublicBookkeepingProposal({ assessment: { featuredImageUrl: "javascript:alert(1)" } })).toThrow();
  });

  it("hourly DTO excludes invoicingEmail, phone, and snapshot internals", () => {
    const privateValue = "PRIVATE_SENTINEL_DO_NOT_PUBLISH";
    const result = toPublicHourlyProposal({
      snapshot: {
        kind: "consulting",
        contactInfo: {
          companyName: "Example LLC",
          invoicingEmail: privateValue,
          primaryContact: {
            firstName: "Alex",
            lastName: "Example",
            email: "alex@example.test",
            phone: privateValue,
            crmContactId: privateValue,
          },
          owners: [{ id: "owner", phone: privateValue, crmContactId: privateValue }],
        },
        agreementTemplateId: privateValue,
        agreementTemplateName: privateValue,
        assessmentNotes: privateValue,
        internal: privateValue,
      },
      checkout: {
        catalogItemLabel: "Consulting hour",
        quantity: 2,
        unitPrice: 150,
        intakeFee: 50,
        subtotal: 300,
        total: 350,
        amountDueNow: 350,
        stripePaymentIntentId: privateValue,
        secret: privateValue,
      },
      brand: { name: "Southwest", accent: "#123456" },
      agreementText: "Public agreement",
      flags: {
        proposalToken: "token",
        engagementId: "eng",
        isTestProposal: false,
        isStaffPreview: false,
        alreadySigned: false,
        kindLabel: "Hourly consulting",
      },
    });
    expect(JSON.stringify(result)).not.toContain(privateValue);
    expect(result.contact.email).toBe("alex@example.test");
    expect(result.clientName).toBe("Example LLC");
    expect(result.offer.catalogItemLabel).toBe("Consulting hour");
    expect(result).not.toHaveProperty("invoicingEmail");
  });

  it("hourly DTO uses primary email, not invoicingEmail", () => {
    const privateValue = "PRIVATE_SENTINEL_DO_NOT_PUBLISH";
    const result = toPublicHourlyProposal({
      snapshot: {
        contactInfo: {
          invoicingEmail: privateValue,
          primaryContact: { firstName: "Alex", lastName: "Example", email: "alex@example.test" },
        },
      },
      checkout: {
        catalogItemLabel: "Coaching",
        quantity: 1,
        unitPrice: 200,
        intakeFee: 0,
        subtotal: 200,
        total: 200,
        amountDueNow: 200,
      },
      brand: { name: "Firm", accent: null },
      agreementText: "Agreement",
      flags: {
        proposalToken: "t",
        engagementId: null,
        isTestProposal: true,
        alreadySigned: false,
        kindLabel: "Hourly coaching",
      },
    });
    expect(JSON.stringify(result)).not.toContain(privateValue);
    expect(result.contact.email).toBe("alex@example.test");
  });

  it("replaces catalog internalDescription with clientBenefit on public options and bonuses", () => {
    const privateValue = "PRIVATE_SENTINEL_DO_NOT_PUBLISH";
    const catalogCopy = catalogCopyFromRows([
      { offerKey: "reports", clientBenefit: "Monthly reporting for you", internalDescription: privateValue },
      { offerKey: "portal", clientBenefit: "Client portal access", internalDescription: privateValue },
    ]);
    const result = toPublicBookkeepingProposal({
      assessment: {
        additionalOptions: [{
          id: "reports", name: "Reports", description: privateValue,
          monthlyPrice: 50, showInProposal: true, archived: false,
        }],
        bonuses: [{ id: "portal", name: "Portal", description: privateValue, archived: false }],
      },
      contactInfo: {},
      pricing: { maintain: { monthly: 500 }, improve: { monthly: 600 }, grow: { monthly: 750 } },
    }, catalogCopy);
    expect(JSON.stringify(result)).not.toContain(privateValue);
    expect(result.assessment.additionalOptions[0].description).toBe("Monthly reporting for you");
    expect(result.assessment.bonuses[0].description).toBe("Client portal access");
  });

  it("returns a null company bundle for a single plain main company", () => {
    const result = toPublicBookkeepingProposal({
      assessment: {
        companies: [
          { id: "main", name: "Main Co", ownQboFile: true, fileStatus: "existing", locationsCount: 0, propertiesCount: 0, accounts: [] },
        ],
      },
      pricing,
    });
    expect(result.companyBundle).toBeNull();
    expect(result.assessment).not.toHaveProperty("companies");
  });

  it("publishes a whitelisted company bundle and keeps raw companies stripped", () => {
    const privateValue = "PRIVATE_SENTINEL_DO_NOT_PUBLISH";
    const companies = [
      {
        id: "main-secret-id",
        name: "Main Co",
        ownQboFile: true,
        fileStatus: "existing",
        locationsCount: 0, propertiesCount: 0,
        accounts: [
          { id: privateValue, kind: "checking", label: "Chase", last4: "1234", status: "open", monthlyTransactions: 80, basis: "measured", source: privateValue, secret: privateValue },
        ],
      },
      {
        id: "second-secret-id",
        name: "Second Co",
        ownQboFile: true,
        fileStatus: "new_file",
        locationsCount: 0, propertiesCount: 0,
        accounts: [
          { id: privateValue, kind: "checking", label: "Second", status: "open", monthlyTransactions: 10, basis: "measured", source: privateValue },
        ],
      },
    ];
    // The published one bundle object, priced at a 50% discount: the public
    // block must read these snapshot values, not recompute from the
    // assessment (whose override says 20%).
    const companyBundle = buildCompanyBundleSnapshot({
      companies,
      baseAssessment: {},
      options: { additionalCompanyDiscountPct: 50, locationMonthlyCharge: 25, newFileSetupCharge: 150 },
    });
    const result = toPublicBookkeepingProposal({
      assessment: {
        assessmentNotes: privateValue,
        companies,
        bundlePricingOptions: {
          additionalCompanyDiscountPct: 20,
          locationMonthlyCharge: 25,
          newFileSetupCharge: 150,
        },
      },
      pricing: { maintain: { monthly: 450 }, improve: { monthly: 600 }, grow: { monthly: 750 }, companyBundle },
    });
    expect(result.companyBundle).toEqual({
      maintain: {
        companies: [
          { name: "Main Co", ownQboFile: true, monthly: 250, setupOneTime: 0, migrationFlagged: false },
          { name: "Second Co", ownQboFile: true, monthly: 125, setupOneTime: 150, migrationFlagged: false },
        ],
        locationsCount: 0,
        locationsMonthly: 0,
        bundleMonthly: 375,
      },
      improve: {
        companies: [
          { name: "Main Co", ownQboFile: true, monthly: 250, setupOneTime: 0, migrationFlagged: false },
          { name: "Second Co", ownQboFile: true, monthly: 125, setupOneTime: 150, migrationFlagged: false },
        ],
        locationsCount: 0,
        locationsMonthly: 0,
        bundleMonthly: 375,
      },
      grow: {
        companies: [
          { name: "Main Co", ownQboFile: true, monthly: 375, setupOneTime: 0, migrationFlagged: false },
          { name: "Second Co", ownQboFile: true, monthly: 190, setupOneTime: 150, migrationFlagged: false },
        ],
        locationsCount: 0,
        locationsMonthly: 0,
        bundleMonthly: 565,
      },
    });
    expect(JSON.stringify(result)).not.toContain(privateValue);
    expect(JSON.stringify(result)).not.toContain("second-secret-id");
    expect(result.assessment).not.toHaveProperty("companies");
    expect(result.assessment).not.toHaveProperty("bundlePricingOptions");
    expect(result.assessment).not.toHaveProperty("bundlePricingDefaults");
  });

  it("falls back to recomputation for snapshots that predate the bundle object", () => {
    const companies = [
      { id: "main", name: "Main Co", ownQboFile: true, fileStatus: "existing", locationsCount: 0, propertiesCount: 0, accounts: [] },
      { id: "b", name: "Second Co", ownQboFile: true, fileStatus: "new_file", locationsCount: 0, propertiesCount: 0, accounts: [] },
    ];
    const result = toPublicBookkeepingProposal({
      assessment: {
        companies,
        bundlePricingOptions: { additionalCompanyDiscountPct: 20, locationMonthlyCharge: 25, newFileSetupCharge: 150 },
      },
      pricing: { maintain: { monthly: 450 }, improve: { monthly: 600 }, grow: { monthly: 750 } },
    });
    expect(result.companyBundle?.maintain.bundleMonthly).toBe(450);
    expect(result.companyBundle?.maintain.companies[1]).toMatchObject({ name: "Second Co", monthly: 200 });
  });

  it("reads the per-proposal bundle override before template defaults", () => {
    const companies = [
      { id: "main", name: "Main Co", ownQboFile: true, fileStatus: "existing", locationsCount: 0, propertiesCount: 0, accounts: [] },
      { id: "b", name: "B Co", ownQboFile: true, fileStatus: "existing", locationsCount: 0, propertiesCount: 0, accounts: [] },
    ];
    const overridden = toPublicBookkeepingProposal({
      assessment: {
        companies,
        bundlePricingDefaults: { additionalCompanyDiscountPct: 20, locationMonthlyCharge: 25, newFileSetupCharge: 150 },
        bundlePricingOptions: { additionalCompanyDiscountPct: 50, locationMonthlyCharge: 25, newFileSetupCharge: 150 },
      },
      pricing,
    });
    expect(overridden.companyBundle?.maintain.bundleMonthly).toBe(375);
    const fromDefaults = toPublicBookkeepingProposal({
      assessment: {
        companies,
        bundlePricingDefaults: { additionalCompanyDiscountPct: 20, locationMonthlyCharge: 25, newFileSetupCharge: 150 },
      },
      pricing,
    });
    expect(fromDefaults.companyBundle?.maintain.bundleMonthly).toBe(450);
  });

  it("blanks public description when catalog clientBenefit is empty and snapshot description equals internalDescription", () => {
    const privateValue = "PRIVATE_SENTINEL_DO_NOT_PUBLISH";
    const catalogCopy = catalogCopyFromRows([
      { offerKey: "reports", clientBenefit: "", internalDescription: privateValue },
    ]);
    const result = toPublicBookkeepingProposal({
      assessment: {
        additionalOptions: [{
          id: "reports", name: "Reports", description: privateValue,
          monthlyPrice: 50, showInProposal: true, archived: false,
        }],
        bonuses: [{ id: "reports", name: "Reports", description: privateValue, archived: false }],
      },
      contactInfo: {},
      pricing: { maintain: { monthly: 500 }, improve: { monthly: 600 }, grow: { monthly: 750 } },
    }, catalogCopy);
    expect(JSON.stringify(result)).not.toContain(privateValue);
    expect(result.assessment.additionalOptions[0].description).toBe("");
    expect(result.assessment.bonuses[0].description).toBe("");
  });

  it("renders the frozen option copy instead of the live catalog", () => {
    const pricing = { maintain: { monthly: 500 }, improve: { monthly: 600 }, grow: { monthly: 750 } };
    const snapshot = {
      assessment: {
        additionalOptions: [{
          id: "reports", name: "Reports", description: "Frozen reports text.",
          monthlyPrice: 50, showInProposal: true, archived: false,
        }],
        bonuses: [{ id: "portal", name: "Portal", description: "Frozen portal text.", archived: false }],
      },
      renderedOptionCopy: { reports: "Frozen reports text.", portal: "Frozen portal text." },
      contactInfo: {},
      pricing,
    };
    // The live catalog changed after publish: the frozen page must not move.
    const editedCatalog = catalogCopyFromRows([
      { offerKey: "reports", clientBenefit: "Edited catalog text with 24/7 help." },
      { offerKey: "portal", clientBenefit: "Edited portal text." },
    ]);
    const frozen = toPublicBookkeepingProposal(snapshot, editedCatalog);
    expect(frozen.assessment.additionalOptions[0].description).toBe("Frozen reports text.");
    expect(frozen.assessment.bonuses[0].description).toBe("Frozen portal text.");
  });

  it("keeps the live remap for snapshots without the frozen key", () => {
    const pricing = { maintain: { monthly: 500 }, improve: { monthly: 600 }, grow: { monthly: 750 } };
    const snapshot = {
      assessment: {
        additionalOptions: [{
          id: "reports", name: "Reports", description: "Stored text.",
          monthlyPrice: 50, showInProposal: true, archived: false,
        }],
        bonuses: [],
      },
      contactInfo: {},
      pricing,
    };
    const live = toPublicBookkeepingProposal(
      snapshot,
      catalogCopyFromRows([{ offerKey: "reports", clientBenefit: "Live catalog text." }]),
    );
    expect(live.assessment.additionalOptions[0].description).toBe("Live catalog text.");
  });
});

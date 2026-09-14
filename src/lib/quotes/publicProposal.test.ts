import { describe, expect, it } from "vitest";
import {
  catalogCopyFromRows,
  toPublicBookkeepingProposal,
  toPublicHourlyProposal,
} from "./publicProposal";

describe("public proposal data boundary", () => {
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
});

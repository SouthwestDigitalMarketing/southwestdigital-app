import { describe, expect, it } from "vitest";
import { toPublicBookkeepingProposal } from "./publicProposal";

describe("public proposal data boundary", () => {
  it("keeps published prices and excludes internal data at every nesting level", () => {
    const privateValue = "PRIVATE_SENTINEL_DO_NOT_PUBLISH";
    const result = toPublicBookkeepingProposal({
      assessment: {
        assessmentNotes: privateValue, discretionaryMultiplierNote: privateValue,
        discretionaryMultiplier: 8, payrollContactEmail: privateValue,
        bankAccountsCount: 31, adminAssistantPhone: privateValue,
        introHeadline: "Your bookkeeping plan",
        historicalCleanupPeriods: [{ id: "2025", year: 2025, startMonth: 1, endMonth: 12, secret: privateValue }],
        additionalOptions: [{ id: "reports", name: "Reports", description: "Monthly reporting", monthlyPrice: 50, showInProposal: true, archived: false, applicabilityReason: privateValue }],
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
    expect(result.pricing.maintain).toEqual({ monthly: 500 });
    expect(result.contactInfo.primaryContact.email).toBe("alex@example.test");
    expect(result.contactInfo.owners).toEqual([]);
  });

  it("does not recalculate missing published prices from internal assessment", () => {
    expect(() => toPublicBookkeepingProposal({ assessment: {}, pricing: {} })).toThrow();
  });

  it("rejects active content URLs", () => {
    expect(() => toPublicBookkeepingProposal({ assessment: { featuredImageUrl: "javascript:alert(1)" } })).toThrow();
  });
});

import { AttributionTouchType, MarketingConsentStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createContactSchema, createCustomerAccountSchema, createLeadSchema } from "./schemas";

describe("CRM input schemas", () => {
  it("normalizes contact email without inferring marketing consent", () => {
    const contact = createContactSchema.parse({
      displayName: "Dagny",
      email: " Dagny@Example.COM ",
    });
    expect(contact.email).toBe("dagny@example.com");
    expect(contact.marketingConsent).toBe(MarketingConsentStatus.UNKNOWN);
  });

  it("retains brand-independent Meta attribution fields", () => {
    const lead = createLeadSchema.parse({
      name: "Melbourne CFO lead",
      email: "lead@example.com",
      estimatedValue: "4500",
      valueCurrency: "aud",
      attribution: {
        source: "facebook",
        medium: "paid_social",
        campaign: "fractional-cfo",
        fbclid: "test-click-id",
      },
    });
    expect(lead.valueCurrency).toBe("AUD");
    expect(lead.attribution).toMatchObject({
      touchType: AttributionTouchType.FIRST_TOUCH,
      fbclid: "test-click-id",
    });
  });

  it("normalizes customer communication fields", () => {
    const customer = createCustomerAccountSchema.parse({
      name: "Example Pty Ltd",
      code: "MEL-001",
      communicationEmail: " Accounts@Example.COM ",
      principalAddressCountryCode: "au",
    });
    expect(customer.communicationEmail).toBe("accounts@example.com");
    expect(customer.principalAddressCountryCode).toBe("AU");
  });

  it("rejects malformed currency and URLs", () => {
    expect(
      createLeadSchema.safeParse({
        name: "Bad lead",
        valueCurrency: "dollars",
        attribution: { landingPageUrl: "not-a-url" },
      }).success,
    ).toBe(false);
  });
});

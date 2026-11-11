import { describe, expect, it } from "vitest";
import { destinationPaymentIntentParams } from "./paymentIntentParams";

describe("destinationPaymentIntentParams", () => {
  it("charges the platform when no connected account is ready", () => {
    const params = destinationPaymentIntentParams({
      amountInCents: 25000,
      engagementId: "eng_1",
      brandId: "brand_1",
    });
    expect(params.transfer_data).toBeUndefined();
    expect(params.metadata).toEqual({ engagementId: "eng_1", brandId: "brand_1" });
  });

  it("sends the deposit to the connected brand account", () => {
    const params = destinationPaymentIntentParams({
      amountInCents: 25000,
      engagementId: "eng_1",
      brandId: "brand_1",
      connectedAccountId: "acct_connected",
    });
    expect(params.transfer_data).toEqual({ destination: "acct_connected" });
    expect(params.metadata.connectedAccountId).toBe("acct_connected");
  });
});

describe("destinationPaymentIntentParams payment methods", () => {
  it("offers ACH bank debit beside card with instant verification", () => {
    const params = destinationPaymentIntentParams({ amountInCents: 25000, engagementId: "eng_1", brandId: "brand_1" });
    expect(params.payment_method_types).toEqual(["card", "us_bank_account"]);
    expect(params.payment_method_options?.us_bank_account.verification_method).toBe("automatic");
  });

  it("falls back to card only when bank debit is turned off", () => {
    const params = destinationPaymentIntentParams({ amountInCents: 25000, engagementId: "eng_1", brandId: "brand_1", allowBankDebit: false });
    expect(params.payment_method_types).toEqual(["card"]);
    expect(params.payment_method_options).toBeUndefined();
  });
});

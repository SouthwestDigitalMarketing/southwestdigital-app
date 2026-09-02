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

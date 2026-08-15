import { IntegrationAssetOwner, IntegrationProvider } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { saveBrandIntegrationSchema } from "./schemas";

describe("brand integration governance schema", () => {
  it("records a client-owned GA4 property without accepting secrets", () => {
    const input = saveBrandIntegrationSchema.parse({
      brandId: "melbourne",
      key: " WEBSITE-GA4 ",
      provider: IntegrationProvider.GA4,
      assetOwner: IntegrationAssetOwner.BRAND,
      externalAccountId: "123456",
      externalPropertyId: "987654321",
      publicIdentifier: "G-ABC123DEF4",
      secretCiphertext: "must-not-be-accepted",
    });

    expect(input.key).toBe("website-ga4");
    expect(input.assetOwner).toBe(IntegrationAssetOwner.BRAND);
    expect("secretCiphertext" in input).toBe(false);
    expect("status" in input).toBe(false);
  });

  it("supports Southwest-managed GTM and brand-owned Meta assets independently", () => {
    expect(
      saveBrandIntegrationSchema.parse({
        brandId: "melbourne",
        key: "website-gtm",
        provider: IntegrationProvider.GTM,
        assetOwner: IntegrationAssetOwner.SOUTHWEST_DIGITAL,
        publicIdentifier: "GTM-ABC1234",
      }).assetOwner,
    ).toBe(IntegrationAssetOwner.SOUTHWEST_DIGITAL);

    expect(
      saveBrandIntegrationSchema.parse({
        brandId: "melbourne",
        key: "meta-pixel",
        provider: IntegrationProvider.META_ADS,
        assetOwner: IntegrationAssetOwner.BRAND,
        publicIdentifier: "123456789012345",
      }).assetOwner,
    ).toBe(IntegrationAssetOwner.BRAND);
  });

  it("rejects unknown providers, owners, and unsafe keys", () => {
    expect(
      saveBrandIntegrationSchema.safeParse({
        brandId: "brand-1",
        key: "../../secret",
        provider: "FACEBOOK_PASSWORD",
        assetOwner: "PLATFORM_ADMIN",
      }).success,
    ).toBe(false);
  });
});

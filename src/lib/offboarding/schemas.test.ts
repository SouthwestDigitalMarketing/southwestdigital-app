import { BrandDataExportScope } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  beginBrandOffboardingSchema,
  cancelBrandOffboardingSchema,
  requestBrandDataExportSchema,
  scheduleBrandOffboardingSchema,
} from "./schemas";

describe("offboarding and export schemas", () => {
  it("accepts explicit export scopes", () => {
    const input = requestBrandDataExportSchema.parse({
      brandId: "melbourne",
      scopes: [
        BrandDataExportScope.BRAND_CONFIGURATION,
        BrandDataExportScope.CRM,
        BrandDataExportScope.INTEGRATION_METADATA,
      ],
    });
    expect(input.scopes).toContain(BrandDataExportScope.CRM);
  });

  it("requires offset-aware ordered offboarding instants", () => {
    const input = scheduleBrandOffboardingSchema.parse({
      brandId: "melbourne",
      confirmSlug: "melbourne-cfo",
      serviceEndsAt: "2026-09-01T17:00:00+10:00",
      accessEndsAt: "2026-09-02T17:00:00+10:00",
      retentionEndsAt: "2026-12-01T17:00:00+11:00",
    });
    expect(input.accessEndsAt).toBeInstanceOf(Date);

    expect(
      scheduleBrandOffboardingSchema.safeParse({
        brandId: "melbourne",
        confirmSlug: "melbourne-cfo",
        serviceEndsAt: "2026-09-02T17:00:00",
        accessEndsAt: "2026-09-01T17:00:00+10:00",
        retentionEndsAt: "2026-08-01T17:00:00+10:00",
      }).success,
    ).toBe(false);
  });

  it("requires a confirmation slug to begin revoking access", () => {
    expect(beginBrandOffboardingSchema.safeParse({ planId: "plan-1" }).success).toBe(false);
    expect(
      beginBrandOffboardingSchema.parse({ planId: "plan-1", confirmSlug: "melbourne-cfo" }),
    ).toEqual({ planId: "plan-1", confirmSlug: "melbourne-cfo" });
    expect(
      cancelBrandOffboardingSchema.parse({ planId: "plan-1", confirmSlug: "melbourne-cfo" }),
    ).toEqual({ planId: "plan-1", confirmSlug: "melbourne-cfo" });
  });
});

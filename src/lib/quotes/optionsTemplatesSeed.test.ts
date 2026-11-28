import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, capabilities } = vi.hoisted(() => ({
  findMany: vi.fn(),
  capabilities: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { catalogService: { findMany } } }));
vi.mock("@/lib/database/schemaCapabilities", () => ({
  getSchemaCapabilities: capabilities,
}));

import { buildDefaultBookkeepingSlice } from "./optionsTemplatesSeed";
import { DEFAULT_BUNDLE_PRICING_OPTIONS } from "./companyBundle";
import { buildOptionsTemplateSnapshot } from "./optionsTemplates";

beforeEach(() => {
  capabilities.mockResolvedValue({
    proposalCatalog: true,
    proposalPackageDefaults: true,
    catalogProductKind: true,
  });
  findMany.mockResolvedValue([]);
});

describe("options template seed bundle defaults", () => {
  it("seeds the default slice with the proposed bundle amounts but no setup charge", async () => {
    const slice = await buildDefaultBookkeepingSlice("brand-test");
    // The setup charge stays unset so the catalog price can win over the
    // $150 placeholder at resolution time.
    expect(slice.bundlePricingDefaults).toEqual({
      additionalCompanyDiscountPct: DEFAULT_BUNDLE_PRICING_OPTIONS.additionalCompanyDiscountPct,
      locationMonthlyCharge: DEFAULT_BUNDLE_PRICING_OPTIONS.locationMonthlyCharge,
    });
    expect(slice.bundlePricingDefaults).not.toHaveProperty("newFileSetupCharge");
    const snapshot = buildOptionsTemplateSnapshot(slice);
    expect(snapshot.bundlePricingDefaults).toEqual(slice.bundlePricingDefaults);
  });

  it("omits desktop-migration defaults so the code defaults win", async () => {
    const slice = await buildDefaultBookkeepingSlice("brand-test");
    // No migration keys are seeded: resolution falls through to the code
    // defaults (fresh start $640, history $150/yr capped at 5, band adds).
    expect(slice.desktopMigrationDefaults).toBeUndefined();
    const snapshot = buildOptionsTemplateSnapshot(slice);
    expect(snapshot.desktopMigrationDefaults).toEqual({});
  });
});

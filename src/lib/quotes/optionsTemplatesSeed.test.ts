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
  it("seeds the default slice with the proposed bundle amounts", async () => {
    const slice = await buildDefaultBookkeepingSlice("brand-test");
    expect(slice.bundlePricingDefaults).toEqual(DEFAULT_BUNDLE_PRICING_OPTIONS);
    const snapshot = buildOptionsTemplateSnapshot(slice);
    expect(snapshot.bundlePricingDefaults).toEqual(DEFAULT_BUNDLE_PRICING_OPTIONS);
  });
});

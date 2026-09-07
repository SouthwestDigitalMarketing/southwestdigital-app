import { beforeEach, describe, expect, it, vi } from "vitest";
const { findMany, capabilities } = vi.hoisted(() => ({
  findMany: vi.fn(),
  capabilities: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { catalogService: { findMany } } }));
vi.mock("@/lib/database/schemaCapabilities", () => ({
  getSchemaCapabilities: capabilities,
}));
import { materializeProposalCatalog } from "./materializeProposalCatalog";
import { proposalServiceAddOns } from "./proposalServices";

const service = {
  offerKey: "reports",
  code: "reports",
  name: "Reports",
  clientBenefit: "Current copy",
  internalDescription: "",
  defaultInclusion: "optional",
  offerSection: "options",
  defaultPackageKeys: ["maintain"],
  defaultPrice: 200,
  billingCadence: "monthly",
  requiresPlatformMigration: false,
  requiredTargetPlatform: null,
  applicabilityNote: null,
  realEstateSpecific: false,
  tags: [],
};
const saved = {
  servicesInitialized: true,
  additionalOptions: [],
  bonuses: [
    {
      id: "reports",
      name: "Old",
      description: "",
      archived: false,
      billingCadence: "one-time",
      defaultPackageIds: ["improve", "grow"],
      addOnPrice: 65,
      addOnPackageIds: ["maintain"],
    },
  ],
  bonusPackageSelections: { reports: ["improve", "grow"] },
  optionsCatalogOrder: ["reports"],
};
beforeEach(() => {
  capabilities.mockResolvedValue({
    proposalCatalog: true,
    proposalPackageDefaults: true,
    catalogProductKind: true,
  });
  findMany.mockResolvedValue([service]);
});

describe("catalog materialization", () => {
  it("preserves optional-to-included conversion through saving and publishing", async () => {
    const draft = await materializeProposalCatalog("brand-test", saved);
    const published = await materializeProposalCatalog("brand-test", draft, {
      freezeApplicability: true,
    });
    expect(published).toMatchObject({
      servicesInitialized: true,
      additionalOptions: [],
      bonusPackageSelections: saved.bonusPackageSelections,
      bonuses: [
        {
          ...saved.bonuses[0],
          name: "Reports",
          description: "Current copy",
          applicable: true,
        },
      ],
    });
    expect(proposalServiceAddOns(published)).toEqual([
      expect.objectContaining({
        id: "reports",
        monthlyPrice: 65,
        billingCadence: "one-time",
        packageIds: ["maintain"],
      }),
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          brandId: "brand-test",
          active: true,
          productKind: "bookkeeping",
        },
      }),
    );
  });
  it("does not resurrect archived rows or replace saved ranges with catalogue defaults", async () => {
    const result = await materializeProposalCatalog("brand-test", {
      ...saved,
      bonuses: [
        {
          ...saved.bonuses[0],
          archived: true,
          defaultPackageIds: ["maintain", "grow"],
        },
      ],
      bonusPackageSelections: { reports: [] },
    });
    expect(result).toMatchObject({
      bonuses: [{ archived: true, defaultPackageIds: ["maintain", "grow"] }],
      bonusPackageSelections: { reports: [] },
    });
  });
  it("distinguishes a new offer from an intentionally empty offer", async () => {
    expect(await materializeProposalCatalog("brand-test", {})).toMatchObject({
      additionalOptions: [{ id: "reports", packageIds: ["maintain"] }],
    });
    expect(
      await materializeProposalCatalog("brand-test", {
        servicesInitialized: true,
      }),
    ).toMatchObject({ additionalOptions: [], bonuses: [] });
  });
  it("uses active real-estate tags consistently with the editor", async () => {
    findMany.mockResolvedValue([
      {
        ...service,
        tags: [{ tag: { key: "real-estate", label: "Real estate" } }],
      },
    ]);
    const result = await materializeProposalCatalog(
      "brand-test",
      { ...saved, bookSetType: "other-business" },
      { freezeApplicability: true },
    );
    expect(result).toMatchObject({
      bonuses: [{ applicable: false, realEstateSpecific: true }],
    });
    expect(proposalServiceAddOns(result)).toEqual([]);
  });
  it("does not retain stale frozen applicability when saving a draft", async () => {
    const result = await materializeProposalCatalog("brand-test", {
      ...saved,
      bonuses: [
        {
          ...saved.bonuses[0],
          applicable: false,
          applicabilityReason: "Stale",
        },
      ],
    });
    expect(result).toHaveProperty("bonuses.0");
    expect((result as typeof saved).bonuses[0]).not.toHaveProperty(
      "applicable",
    );
  });
  it("leaves legacy schema snapshots alone without querying unavailable tables", async () => {
    findMany.mockClear();
    capabilities.mockResolvedValue({ proposalCatalog: false });
    expect(await materializeProposalCatalog("brand-test", saved)).toBe(saved);
    expect(findMany).not.toHaveBeenCalled();
  });
});

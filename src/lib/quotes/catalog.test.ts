import { describe, expect, it } from "vitest";
import {
  extraIsAvailableForBookSet,
  extraIsRealEstateSpecific,
  proposalCatalogItemApplicability,
  tagMarksRealEstate,
  type ProposalOptionCatalogItem,
} from "./catalog";

const STESSA_MIGRATION: ProposalOptionCatalogItem = {
  id: "service-stessa",
  offerKey: "stessa-migration",
  code: "OFFER-STESSA-MIGRATION",
  name: "QuickBooks to Stessa Migration",
  description: "Move the books to Stessa.",
  defaultInclusion: "included",
  defaultPrice: 0,
  billingCadence: "one-time",
  requiresPlatformMigration: true,
  requiredTargetPlatform: "stessa",
  applicabilityNote: "Shown because this offer moves the books to Stessa.",
  realEstateSpecific: true,
};

describe("real-estate catalog markers", () => {
  it("recognizes the Real estate service tag", () => {
    expect(tagMarksRealEstate({ key: "industry", label: "Real estate service" })).toBe(true);
  });

  it("matches an option or extra to its tagged catalog service", () => {
    expect(
      extraIsRealEstateSpecific(
        { id: "option-1", name: "Property reporting" },
        [{ id: "service-1", code: "option-1", name: "Property reporting", realEstateSpecific: true }],
      ),
    ).toBe(true);
  });

  it("hides tagged options and extras for a non-RE business", () => {
    const extra = { id: "option-1", name: "Property reporting" };
    const catalog = [
      { id: "service-1", code: "option-1", name: "Property reporting", realEstateSpecific: true },
    ];

    expect(extraIsAvailableForBookSet(extra, catalog, "other-business")).toBe(false);
    expect(extraIsAvailableForBookSet(extra, catalog, "real-estate-only")).toBe(true);
  });

  it("keeps untagged options and extras for a non-RE business", () => {
    expect(
      extraIsAvailableForBookSet(
        { id: "option-2", name: "Sales tax filing" },
        [{ id: "service-2", code: "option-2", name: "Sales tax filing", realEstateSpecific: false }],
        "other-business",
      ),
    ).toBe(true);
  });
});

describe("proposal catalog applicability", () => {
  it("explains why the Stessa migration is available", () => {
    expect(
      proposalCatalogItemApplicability(STESSA_MIGRATION, {
        bookSetType: "real-estate-only",
        ongoingBookkeepingPlatform: "stessa",
        platformMigrationEnabled: true,
      }),
    ).toEqual({
      applicable: true,
      reason: "Shown because this offer moves the books to Stessa.",
    });
  });

  it("requires both a migration and the configured target platform", () => {
    expect(
      proposalCatalogItemApplicability(STESSA_MIGRATION, {
        bookSetType: "real-estate-only",
        ongoingBookkeepingPlatform: "stessa",
        platformMigrationEnabled: false,
      }),
    ).toEqual({ applicable: false, reason: "Requires a platform migration in this offer." });

    expect(
      proposalCatalogItemApplicability(STESSA_MIGRATION, {
        bookSetType: "real-estate-only",
        ongoingBookkeepingPlatform: "qbo",
        platformMigrationEnabled: true,
      }).applicable,
    ).toBe(false);
  });

  it("does not offer real-estate-only items to other-business book sets", () => {
    expect(
      proposalCatalogItemApplicability(STESSA_MIGRATION, {
        bookSetType: "other-business",
        ongoingBookkeepingPlatform: "stessa",
        platformMigrationEnabled: true,
      }).applicable,
    ).toBe(false);
  });
});

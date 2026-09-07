import { describe, expect, it } from "vitest";
import type { ProposalOptionCatalogItem } from "@/lib/quotes/catalog";
import {
  reconcileProposalAssessmentWithCatalog,
  type ProposalCatalogSyncAssessment,
} from "./proposalCatalogSync";

function catalogItem(
  offerKey: string,
  overrides: Partial<ProposalOptionCatalogItem> = {},
): ProposalOptionCatalogItem {
  return {
    id: `catalog-${offerKey}`,
    offerKey,
    name: `${offerKey} title`,
    code: null,
    description: `${offerKey} description`,
    defaultInclusion: "included",
    defaultPrice: 0,
    billingCadence: "one-time",
    requiresPlatformMigration: false,
    requiredTargetPlatform: null,
    applicabilityNote: null,
    realEstateSpecific: false,
    ...overrides,
  };
}

function assessment(
  overrides: Partial<ProposalCatalogSyncAssessment>,
): ProposalCatalogSyncAssessment {
  return {
    transactionBand: "0-99",
    advancedReceiptManagementPriceOverride: null,
    projectTrackingPriceOverride: null,
    budgetReportingPriceOverride: null,
    salesTaxFilingPriceOverride: null,
    offerAdvancedReceiptManagement: false,
    offerProjectTracking: false,
    offerBudgetReporting: false,
    offerSalesTaxFiling: false,
    includeTaxPreparerCoordinationCall: false,
    includeRegisteredAgentService: false,
    additionalOptions: [],
    bonuses: [],
    bonusPackageSelections: {},
    optionsCatalogOrder: [],
    ...overrides,
  };
}

describe("proposal catalog synchronization", () => {
  it("uses catalog copy while preserving proposal-specific configuration", () => {
    const result = reconcileProposalAssessmentWithCatalog(
      assessment({
        additionalOptions: [{
          id: "reporting",
          name: "Old title",
          description: "Old description",
          monthlyPrice: 275,
          showInProposal: false,
          archived: true,
        }],
        bonusPackageSelections: { reporting: ["grow"] },
        optionsCatalogOrder: ["reporting"],
      }),
      [catalogItem("reporting", { name: "Advisory Reporting", description: "Current catalog copy" })],
    );

    expect(result.additionalOptions).toEqual([expect.objectContaining({
      id: "reporting",
      name: "Advisory Reporting",
      description: "Current catalog copy",
      monthlyPrice: 275,
      showInProposal: false,
      archived: false,
    })]);
    expect(result.bonusPackageSelections.reporting).toEqual(["grow"]);
  });

  it("adds active catalog services and removes services no longer in the active catalog", () => {
    const result = reconcileProposalAssessmentWithCatalog(
      assessment({
        bonuses: [],
        bonusPackageSelections: {},
        optionsCatalogOrder: [],
      }),
      [
        catalogItem("current", { offerSection: "core-services", defaultPackageIds: ["maintain"] }),
        catalogItem("new-option", { offerSection: "options", defaultInclusion: "optional", defaultPrice: 125 }),
      ],
    );

    expect(result.bonuses.map((item) => item.id)).toEqual(["current"]);
    expect(result.additionalOptions).toEqual([expect.objectContaining({
      id: "new-option",
      monthlyPrice: 125,
    })]);
    expect(result.bonusPackageSelections).toEqual({ current: ["maintain"] });
    expect(result.optionsCatalogOrder).toEqual(["new-option", "current"]);
  });
});

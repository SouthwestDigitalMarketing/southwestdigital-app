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
      archived: true,
    })]);
    expect(result.bonusPackageSelections.reporting).toEqual(["grow"]);
  });

  it("initializes only services with explicit curated package defaults", () => {
    const result = reconcileProposalAssessmentWithCatalog(
      assessment({
        bonuses: [],
        bonusPackageSelections: {},
        optionsCatalogOrder: [],
      }),
      [
        catalogItem("current", { offerSection: "core-services", defaultPackageIds: ["maintain"] }),
        catalogItem("new-option", { offerSection: "options", defaultInclusion: "optional", defaultPackageIds: ["maintain"], defaultPrice: 125 }),
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

describe("saved offer preservation", () => {
  const curated = catalogItem("core", { defaultPackageIds: ["maintain", "improve", "grow"], defaultPrice: 100 });
  it("does not repopulate an intentionally empty initialized offer", () => {
    const result = reconcileProposalAssessmentWithCatalog(assessment({ servicesInitialized: true }), [curated]);
    expect(result.bonuses).toEqual([]);
    expect(result.additionalOptions).toEqual([]);
  });
  it("does not opt uncurated catalogue services into a fresh offer", () => {
    const result = reconcileProposalAssessmentWithCatalog(assessment({}), [
      curated, catalogItem("other"), catalogItem("optional", { defaultInclusion: "optional" }),
    ]);
    expect(result.bonuses.map((item) => item.id)).toEqual(["core"]);
    expect(result.additionalOptions).toEqual([]);
    expect(result.bonuses[0].addOnPrice).toBeUndefined();
    expect(result.servicesInitialized).toBe(true);
  });
  it("keeps saved gaps, empty selections, hidden rows, cadence, prices and converted treatment", () => {
    const saved = assessment({
      bonuses: [{ id: "core", name: "Old", description: "", archived: true, defaultPackageIds: ["maintain", "grow"], addOnPrice: 65, addOnPackageIds: ["improve"] }],
      bonusPackageSelections: { core: [] },
      optionsCatalogOrder: ["core", "core"],
    });
    const result = reconcileProposalAssessmentWithCatalog(saved, [{ ...curated, defaultInclusion: "optional", billingCadence: "monthly" }]);
    expect(result.additionalOptions).toEqual([]);
    expect(result.bonuses[0]).toMatchObject({ archived: true, billingCadence: "one-time", defaultPackageIds: ["maintain", "grow"], addOnPrice: 65, addOnPackageIds: ["improve"] });
    expect(result.bonusPackageSelections.core).toEqual([]);
    expect(result.optionsCatalogOrder).toEqual(["core"]);
    expect(reconcileProposalAssessmentWithCatalog({ ...saved, ...result }, [curated])).toEqual(result);
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("../who/actions", () => ({
  getOfferBuilderContextAction: async () => null,
  saveOfferDraftAction: async () => undefined,
  syncOfferContactsAction: async () => undefined,
}));
import {
  getProposalAdditionalOptions,
  getProposalBonuses,
  useProposalAssessmentDemoState,
  type AssessmentState,
} from "./ProposalCreationWorkspaceDemo";
import { reconcileProposalAssessmentWithCatalog } from "./proposalCatalogSync";
import type { ProposalOptionCatalogItem } from "@/lib/quotes/catalog";

describe("actual builder initialization", () => {
  it("seeds curated services from the real fresh assessment, not a test-only empty fixture", () => {
    let fresh: AssessmentState | undefined;
    function Capture() {
      fresh = useProposalAssessmentDemoState({ persist: false }).assessment;
      return null;
    }
    renderToStaticMarkup(createElement(Capture));
    expect(fresh).toBeDefined();
    expect(fresh!.bonusPackageSelections).toEqual({});
    const catalog: ProposalOptionCatalogItem[] = [
      {
        id: "catalog-core",
        offerKey: "core",
        name: "Core",
        code: null,
        description: "",
        defaultInclusion: "included",
        defaultPackageIds: ["maintain", "improve", "grow"],
        defaultPrice: 0,
        billingCadence: "monthly",
        requiresPlatformMigration: false,
        requiredTargetPlatform: null,
        applicabilityNote: null,
        realEstateSpecific: false,
      },
    ];
    const initialized = {
      ...fresh!,
      ...reconcileProposalAssessmentWithCatalog(fresh!, catalog),
    };
    expect(getProposalBonuses(initialized).map((item) => item.id)).toEqual([
      "core",
    ]);
    expect(getProposalAdditionalOptions(initialized)).toEqual([]);
    const emptied = {
      ...initialized,
      bonuses: [],
      additionalOptions: [],
      bonusPackageSelections: {},
    };
    expect(getProposalBonuses(emptied)).toEqual([]);
    expect(getProposalAdditionalOptions(emptied)).toEqual([]);
    expect(
      reconcileProposalAssessmentWithCatalog(emptied, catalog).bonuses,
    ).toEqual([]);
  });
});

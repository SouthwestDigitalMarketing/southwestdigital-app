import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../who/actions", () => ({
  getOfferBuilderContextAction: async () => null,
  saveOfferDraftAction: async () => undefined,
  syncOfferContactsAction: async () => undefined,
}));

import {
  applyOptionsTemplateSlice,
  getProposalPricingSnapshotData,
  useProposalAssessmentDemoState,
  type AssessmentState,
} from "./ProposalCreationWorkspaceDemo";
import type { OptionsTemplateAssessmentSlice } from "@/lib/quotes/optionsTemplates";
import { effectiveAssessment } from "./effectiveAssessment";
import {
  DEFAULT_BUNDLE_PRICING_OPTIONS,
  normalizeCompanyBundle,
  priceCompanyBundle,
  type CompanyEntry,
} from "@/lib/quotes/companyBundle";

function freshAssessment(): AssessmentState {
  let state: AssessmentState;
  function Capture() {
    state = useProposalAssessmentDemoState({ persist: false }).assessment;
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  return state!;
}

function mainCompany(overrides: Partial<CompanyEntry> = {}): CompanyEntry {
  return {
    id: "main",
    name: "Main Co",
    ownQboFile: true,
    fileStatus: "existing",
    locationsCount: 0, propertiesCount: 0,
    accounts: [],
    complexity: null,
    ...overrides,
  };
}

describe("spec 02 wiring: company bundle in builder package totals", () => {
  it("leaves legacy totals untouched when companies are absent", () => {
    const fresh = freshAssessment();
    const legacy = { ...fresh, numberOfEntities: 3, transactionBand: "500-999" as const };
    const withEmpty = { ...legacy, companies: [] as CompanyEntry[] };
    expect(getProposalPricingSnapshotData(withEmpty)).toEqual(getProposalPricingSnapshotData(legacy));
  });

  it("leaves legacy totals untouched for a single plain main company", () => {
    const fresh = freshAssessment();
    const legacy = { ...fresh, numberOfEntities: 2, numberOfProperties: 3 };
    const withSolo = { ...legacy, companies: normalizeCompanyBundle([mainCompany()]) };
    // A solo plain file is not a bundle: identical numbers to the legacy path.
    expect(getProposalPricingSnapshotData(withSolo)).toEqual(getProposalPricingSnapshotData(legacy));
  });

  it("prices the main file exactly like the legacy entities-zeroed price", () => {
    const fresh = freshAssessment();
    const base = { ...fresh, numberOfEntities: 3, numberOfProperties: 2, transactionBand: "100-499" as const };
    for (const packageId of ["grow", "improve", "maintain"] as const) {
      const solo = priceCompanyBundle({
        companies: [mainCompany()],
        packageId,
        baseAssessment: effectiveAssessment(base),
        options: DEFAULT_BUNDLE_PRICING_OPTIONS,
      });
      const legacyZeroed = getProposalPricingSnapshotData({ ...base, numberOfEntities: 0 });
      expect(solo.perCompany[0].discountedMonthly).toBe(legacyZeroed.packagePricing[packageId].monthly);
    }
  });

  it("adds a second file 20% off with no legacy entity charge", () => {
    const fresh = freshAssessment();
    const assessment: AssessmentState = {
      ...fresh,
      numberOfEntities: 3,
      companies: [mainCompany(), mainCompany({ id: "b", name: "Beta" })],
    };
    const data = getProposalPricingSnapshotData(assessment);
    // Main 250 + Beta (250 standalone -> 200): entity charge of 3 x 100 is gone.
    expect(data.packagePricing.maintain.monthly).toBe(450);
    expect(data.packagePricing.improve.monthly).toBe(450);
    // Grow: main 375 + Beta (375 standalone -> 300).
    expect(data.packagePricing.grow.monthly).toBe(675);
    const legacy = getProposalPricingSnapshotData({ ...fresh, numberOfEntities: 3 });
    expect(legacy.packagePricing.maintain.monthly).toBe(550);
  });

  it("adds locations and setup lines into the bundle monthly", () => {
    const fresh = freshAssessment();
    const assessment: AssessmentState = {
      ...fresh,
      companies: [
        mainCompany({ locationsCount: 2, propertiesCount: 0, fileStatus: "new_file" }),
        mainCompany({ id: "b", name: "Beta" }),
      ],
    };
    const data = getProposalPricingSnapshotData(assessment);
    // 250 + 200 + 2 x 25 locations = 500 (setup is one-time, not monthly).
    expect(data.packagePricing.maintain.monthly).toBe(500);
  });

  it("names the bundle instead of the entity charge in the recommendation rationale", () => {
    const fresh = freshAssessment();
    const assessment: AssessmentState = {
      ...fresh,
      numberOfEntities: 3,
      companies: [mainCompany(), mainCompany({ id: "b", name: "Beta" })],
    };
    const data = getProposalPricingSnapshotData(assessment);
    expect(data.recommendation.rationale).toContain("2 companies priced as a bundle.");
    expect(data.recommendation.rationale.join(" ")).not.toContain("entities increase");
    // Legacy proposals keep citing the entity charge.
    const legacy = getProposalPricingSnapshotData({ ...fresh, numberOfEntities: 3 });
    expect(legacy.recommendation.rationale).toContain(
      "3 entities increase coordination and reporting complexity.",
    );
  });

  it("keeps backlog and cleanup on the entities-zeroed base when bundled", () => {
    const fresh = freshAssessment();
    const assessment: AssessmentState = {
      ...fresh,
      booksOverTwoMonthsBehind: true,
      cleanupStartMonth: "2026-01",
      cleanupEndMonth: "2026-06",
      numberOfEntities: 2,
      historicalCleanupPeriods: [
        { id: "p", year: 2026, startMonth: 1, endMonth: 6, platform: "qbo", purchasedOrSoldPropertiesCount: 1 },
      ],
      companies: [mainCompany(), mainCompany({ id: "b", name: "Beta" })],
    };
    const data = getProposalPricingSnapshotData(assessment);
    const zeroed = getProposalPricingSnapshotData({ ...assessment, numberOfEntities: 0, companies: undefined });
    // Backlog/other one-time figures match the entities-zeroed legacy math; monthly adds Beta's 200.
    expect(data.packagePricing.maintain.catchUpBase).toBe(zeroed.packagePricing.maintain.catchUpBase);
    expect(data.packagePricing.maintain.assessmentOneTimeAdjustments).toBe(
      zeroed.packagePricing.maintain.assessmentOneTimeAdjustments,
    );
    expect(data.packagePricing.maintain.monthly).toBe(zeroed.packagePricing.maintain.monthly + 200);
  });
});

describe("spec 02 template apply: bundlePricingDefaults reach the proposal", () => {
  const discount15Slice: OptionsTemplateAssessmentSlice = {
    optionsCatalogOrder: [],
    additionalOptions: [],
    bonuses: [],
    bonusPackageSelections: {},
    // A manager-saved template default: 15% off each added file.
    bundlePricingDefaults: { additionalCompanyDiscountPct: 15 },
  };

  it("prices the bundle at the applied template discount (15% -> maintain 465)", () => {
    const fresh = freshAssessment();
    const applied = applyOptionsTemplateSlice(
      { ...fresh, companies: [mainCompany(), mainCompany({ id: "b", name: "Beta" })] },
      discount15Slice,
    );
    expect(applied.bundlePricingDefaults).toEqual({ additionalCompanyDiscountPct: 15 });
    const data = getProposalPricingSnapshotData(applied);
    // Main 250 + Beta (250 at 15% off = 212.50, rounded up to 215).
    expect(data.packagePricing.maintain.monthly).toBe(465);
    // The snapshot publishes the template-priced bundle object.
    expect(data.companyBundle?.maintain.bundleMonthly).toBe(465);
    expect(data.companyBundle?.maintain.perCompany[1].discountedMonthly).toBe(215);
  });

  it("lets template-set fields win while the override and other defaults survive", () => {
    const fresh = freshAssessment();
    const applied = applyOptionsTemplateSlice(
      {
        ...fresh,
        companies: [mainCompany(), mainCompany({ id: "b", name: "Beta" })],
        bundlePricingOptions: { additionalCompanyDiscountPct: 30 },
        bundlePricingDefaults: { newFileSetupCharge: 99 },
      },
      discount15Slice,
    );
    expect(applied.bundlePricingDefaults).toEqual({
      newFileSetupCharge: 99,
      additionalCompanyDiscountPct: 15,
    });
    // The per-proposal override is never touched by a template apply.
    expect(applied.bundlePricingOptions).toEqual({ additionalCompanyDiscountPct: 30 });
    // And the override still wins at pricing time: 250 + 175 = 425.
    expect(getProposalPricingSnapshotData(applied).packagePricing.maintain.monthly).toBe(425);
  });

  it("keeps existing proposal defaults when the applied template has none", () => {
    const fresh = freshAssessment();
    const applied = applyOptionsTemplateSlice(
      {
        ...fresh,
        companies: [mainCompany(), mainCompany({ id: "b", name: "Beta" })],
        bundlePricingDefaults: { newFileSetupCharge: 99 },
      },
      { optionsCatalogOrder: [], additionalOptions: [], bonuses: [], bonusPackageSelections: {} },
    );
    expect(applied.bundlePricingDefaults).toEqual({ newFileSetupCharge: 99 });
  });
});

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
  getProposalPricingSnapshotCleanupCard,
  getProposalPricingSnapshotData,
  useProposalAssessmentDemoState,
  type AssessmentState,
} from "./ProposalCreationWorkspaceDemo";

function assessmentWith(overrides: Partial<AssessmentState>): AssessmentState {
  let state: AssessmentState;
  function Capture() {
    state = useProposalAssessmentDemoState({
      persist: false,
      initialAssessment: overrides,
    }).assessment;
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  return state!;
}

function stagedCommingling(extra: Partial<AssessmentState> = {}) {
  return assessmentWith({
    booksOverTwoMonthsBehind: true,
    cleanupStartMonth: "2026-01",
    cleanupEndMonth: "2026-03",
    historicalCleanupPeriods: [],
    complexity: { drivers: { personal_commingling: { checked: true } } },
    ...extra,
  });
}

describe("spec 03 builder wiring", () => {
  it("keeps legacy snapshots free of the complexity key", () => {
    const data = getProposalPricingSnapshotData(
      assessmentWith({ historicalCleanupPeriods: [] }),
    );
    for (const id of ["grow", "improve", "maintain"] as const) {
      expect(data.packagePricing[id]).not.toHaveProperty("complexity");
    }
  });

  it("prices main-company drivers into every tier and grows via the override", () => {
    const data = getProposalPricingSnapshotData(
      assessmentWith({
        historicalCleanupPeriods: [],
        complexity: { drivers: { inventory_cogs: { checked: true } } },
      }),
    );
    expect(data.packagePricing.maintain.monthly).toBe(345);
    expect(data.packagePricing.improve.monthly).toBe(370);
    expect(data.packagePricing.grow.monthly).toBe(520);
    expect(data.packagePricing.maintain.complexity?.monthlyTotal).toBe(95);
    expect(data.packagePricing.maintain.complexity?.lines).toHaveLength(1);
  });

  it("turns a ticked sales-tax driver on in normalization, never in render", () => {
    const assessment = assessmentWith({
      historicalCleanupPeriods: [],
      offerSalesTaxFiling: false,
      offerProjectTracking: false,
      complexity: {
        drivers: { sales_tax: { checked: true }, job_tracking: { checked: true } },
      },
    });
    expect(assessment.offerSalesTaxFiling).toBe(true);
    expect(assessment.offerProjectTracking).toBe(true);
    const idle = assessmentWith({ historicalCleanupPeriods: [] });
    expect(idle.offerSalesTaxFiling).toBe(false);
    expect(idle.offerProjectTracking).toBe(false);
  });

  it("leaves payroll and mixed books to their requires lines without auto-changing inputs", () => {
    const assessment = assessmentWith({
      historicalCleanupPeriods: [],
      bookSetType: "",
      employeesCount: 0,
      contractorsCount: 0,
      complexity: {
        drivers: { payroll: { checked: true }, mixed_books: { checked: true } },
      },
    });
    expect(assessment.bookSetType).toBe("");
    expect(assessment.employeesCount).toBe(0);
    const data = getProposalPricingSnapshotData(assessment);
    expect(data.packagePricing.maintain.monthly).toBe(250);
    expect(data.packagePricing.maintain.complexity?.lines).toEqual([
      expect.objectContaining({ id: "payroll", monthly: 0, requiresExistingLine: "staffing" }),
      expect.objectContaining({ id: "mixed_books", monthly: 0, requiresExistingLine: "mixedBooks" }),
    ]);
  });

  it("adds the complexity cleanup line only when cleanup months exist", () => {
    const staged = stagedCommingling();
    const card = getProposalPricingSnapshotCleanupCard(staged)!;
    // Maintain 250 + 110 commingling; catch-up 360 x 3; cleanup add 40 x 3.
    expect(card.detailRows.some((row) => row.includes("Complexity cleanup add"))).toBe(true);
    expect(card.detailRows.some((row) => row.includes("Personal spending in the business"))).toBe(true);
    expect(card.amountLabel).toContain("1,700");

    const unstaged = getProposalPricingSnapshotCleanupCard(
      assessmentWith({
        historicalCleanupPeriods: [],
        complexity: { drivers: { personal_commingling: { checked: true } } },
      }),
    )!;
    expect(unstaged.detailRows.some((row) => row.includes("Complexity cleanup add"))).toBe(false);
  });

  it("merges template complexity defaults field by field on apply", () => {
    const saved = assessmentWith({
      historicalCleanupPeriods: [],
      complexityDriverDefaults: { inventory_cogs: { monthly: 5 } },
    });
    const next = applyOptionsTemplateSlice(saved, {
      optionsCatalogOrder: [],
      additionalOptions: [],
      bonuses: [],
      bonusPackageSelections: {},
      complexityDriverDefaults: {
        inventory_cogs: { monthly: 120 },
        pos_system: { monthly: 70, cleanupPerMonth: 5 },
      },
    });
    // Template wins where set; the saved patch fills nothing else in.
    expect(next.complexityDriverDefaults).toEqual({
      inventory_cogs: { monthly: 120 },
      pos_system: { monthly: 70, cleanupPerMonth: 5 },
    });
    const kept = applyOptionsTemplateSlice(saved, {
      optionsCatalogOrder: [],
      additionalOptions: [],
      bonuses: [],
      bonusPackageSelections: {},
    });
    expect(kept.complexityDriverDefaults).toEqual({ inventory_cogs: { monthly: 5 } });
  });

  it("strips complexity lines from test-proposal snapshots", () => {
    const data = getProposalPricingSnapshotData(
      assessmentWith({
        historicalCleanupPeriods: [],
        isTestProposal: true,
        complexity: { drivers: { inventory_cogs: { checked: true } } },
      }),
    );
    expect(data.packagePricing.maintain.monthly).toBe(0);
    expect(data.packagePricing.maintain).not.toHaveProperty("complexity");
  });
});

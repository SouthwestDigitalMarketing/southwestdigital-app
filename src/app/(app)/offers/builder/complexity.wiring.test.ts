import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../who/actions", () => ({
  getOfferBuilderContextAction: async () => null,
  saveOfferDraftAction: async () => undefined,
  syncOfferContactsAction: async () => undefined,
}));

import ComplexityChecklist from "./ComplexityChecklist";
import {
  applyAddonFlagChange,
  applyComplexitySelection,
  applyOptionsTemplateSlice,
  complexityDriverAutoOn,
  complexityExistingPresence,
  getProposalPricingSnapshotCleanupCard,
  getProposalPricingSnapshotData,
  mergeStoredAssessment,
  useProposalAssessmentDemoState,
  type AssessmentState,
} from "./ProposalCreationWorkspaceDemo";
import {
  normalizeComplexitySelection,
  type ComplexitySelection,
} from "@/lib/quotes/complexityDrivers";

/**
 * Test selections are partial by nature (one or two ticked drivers); the
 * production `ComplexitySelection.drivers` is a full Record, so normalize a
 * bare drivers record into a full selection instead of loosening the type.
 */
function selectionWith(
  drivers: Record<string, { checked: true; name?: string; count?: number; monthlyOverride?: number }>,
): ComplexitySelection {
  return normalizeComplexitySelection({ drivers });
}

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
    complexity: selectionWith({ personal_commingling: { checked: true } }),
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
        complexity: selectionWith({ inventory_cogs: { checked: true } }),
      }),
    );
    expect(data.packagePricing.maintain.monthly).toBe(345);
    expect(data.packagePricing.improve.monthly).toBe(370);
    expect(data.packagePricing.grow.monthly).toBe(520);
    expect(data.packagePricing.maintain.complexity?.monthlyTotal).toBe(95);
    expect(data.packagePricing.maintain.complexity?.lines).toHaveLength(1);
  });

  it("load never re-enables an add-on the user turned off", () => {
    const assessment = assessmentWith({
      historicalCleanupPeriods: [],
      offerSalesTaxFiling: false,
      offerProjectTracking: false,
      complexity: selectionWith({ sales_tax: { checked: true }, job_tracking: { checked: true } }),
    });
    // Stored OFF stays OFF across reload — the checklist prices a
    // "Will add <line>" waiting row instead of silently raising the price.
    expect(assessment.offerSalesTaxFiling).toBe(false);
    expect(assessment.offerProjectTracking).toBe(false);
    expect(assessment.complexity?.drivers.sales_tax).toEqual({ checked: true });
    expect(assessment.complexity?.drivers.job_tracking).toEqual({ checked: true });
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
      complexity: selectionWith({ payroll: { checked: true }, mixed_books: { checked: true } }),
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
    expect((card.detailRows ?? []).some((row) => row.includes("Complexity cleanup add"))).toBe(true);
    expect((card.detailRows ?? []).some((row) => row.includes("Personal spending in the business"))).toBe(true);
    expect(card.amountLabel).toContain("1,700");

    const unstaged = getProposalPricingSnapshotCleanupCard(
      assessmentWith({
        historicalCleanupPeriods: [],
        complexity: selectionWith({ personal_commingling: { checked: true } }),
      }),
    )!;
    expect((unstaged.detailRows ?? []).some((row) => row.includes("Complexity cleanup add"))).toBe(false);
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
        complexity: selectionWith({ inventory_cogs: { checked: true } }),
      }),
    );
    expect(data.packagePricing.maintain.monthly).toBe(0);
    expect(data.packagePricing.maintain).not.toHaveProperty("complexity");
  });
});

describe("spec 03 sales-tax / project-tracking auto-on", () => {
  it("live edits turn the add-ons on in the same state update", () => {
    const base = assessmentWith({ historicalCleanupPeriods: [] });
    expect(base.offerSalesTaxFiling).toBe(false);
    expect(base.offerProjectTracking).toBe(false);
    const next = applyComplexitySelection(
      base,
      selectionWith({ sales_tax: { checked: true }, job_tracking: { checked: true } }),
    );
    expect(next.offerSalesTaxFiling).toBe(true);
    expect(next.offerProjectTracking).toBe(true);
    // The selection still normalizes tolerantly on the live path.
    expect(next.complexity?.drivers.sales_tax).toEqual({ checked: true });
  });

  it("only the live tick turns the add-on on; load keeps stored flags", () => {
    const loaded = assessmentWith({
      historicalCleanupPeriods: [],
      offerSalesTaxFiling: false,
      offerProjectTracking: false,
      complexity: selectionWith({ sales_tax: { checked: true }, job_tracking: { checked: true } }),
    });
    expect(loaded.offerSalesTaxFiling).toBe(false);
    expect(loaded.offerProjectTracking).toBe(false);
    const live = applyComplexitySelection(
      assessmentWith({ historicalCleanupPeriods: [] }),
      selectionWith({ sales_tax: { checked: true }, job_tracking: { checked: true } }),
    );
    expect(live.offerSalesTaxFiling).toBe(true);
    expect(live.offerProjectTracking).toBe(true);
  });

  it("turning the add-on off unticks its driver in the same update", () => {
    const ticked = applyComplexitySelection(
      assessmentWith({ historicalCleanupPeriods: [] }),
      selectionWith({ sales_tax: { checked: true }, job_tracking: { checked: true } }),
    );
    expect(ticked.offerSalesTaxFiling).toBe(true);
    expect(ticked.offerProjectTracking).toBe(true);
    const salesOff = applyAddonFlagChange(ticked, "offerSalesTaxFiling", false);
    expect(salesOff.offerSalesTaxFiling).toBe(false);
    expect(salesOff.complexity?.drivers.sales_tax).toEqual({ checked: false });
    // The other add-on and driver are untouched.
    expect(salesOff.offerProjectTracking).toBe(true);
    expect(salesOff.complexity?.drivers.job_tracking).toEqual({ checked: true });
    const trackingOff = applyAddonFlagChange(salesOff, "offerProjectTracking", false);
    expect(trackingOff.offerProjectTracking).toBe(false);
    expect(trackingOff.complexity?.drivers.job_tracking).toEqual({ checked: false });
    expect(trackingOff.complexity?.drivers.sales_tax).toEqual({ checked: false });
  });

  it("turning the add-on on leaves drivers alone", () => {
    const base = assessmentWith({ historicalCleanupPeriods: [] });
    const on = applyAddonFlagChange(base, "offerSalesTaxFiling", true);
    expect(on.offerSalesTaxFiling).toBe(true);
    expect(on.complexity).toBeUndefined();
    const ticked = applyComplexitySelection(
      base,
      selectionWith({ inventory_cogs: { checked: true } }),
    );
    const onWithDrivers = applyAddonFlagChange(ticked, "offerProjectTracking", true);
    expect(onWithDrivers.offerProjectTracking).toBe(true);
    expect(onWithDrivers.complexity?.drivers.inventory_cogs).toEqual({ checked: true });
    expect(onWithDrivers.complexity?.drivers.job_tracking).toEqual({ checked: false });
  });

  it("reload keeps a user-turned-off add-on off with its driver unticked", () => {
    const base = assessmentWith({ historicalCleanupPeriods: [] });
    const ticked = applyComplexitySelection(
      base,
      selectionWith({ sales_tax: { checked: true } }),
    );
    const turnedOff = applyAddonFlagChange(ticked, "offerSalesTaxFiling", false);
    // Simulate save -> reload through the stored JSON.
    const reloaded = mergeStoredAssessment(
      JSON.stringify({ complexity: turnedOff.complexity, offerSalesTaxFiling: turnedOff.offerSalesTaxFiling }),
      base,
    );
    expect(reloaded.offerSalesTaxFiling).toBe(false);
    expect(reloaded.complexity?.drivers.sales_tax).toEqual({ checked: false });
    // Pricing charges nothing and waits on no line.
    const data = getProposalPricingSnapshotData(reloaded);
    expect(data.packagePricing.maintain.complexity?.lines ?? []).toEqual([]);
  });

  it("unticking a driver never silently unticks an independently chosen add-on", () => {
    // Add-on on by the user's own choice, driver never ticked.
    const independent = assessmentWith({
      historicalCleanupPeriods: [],
      offerSalesTaxFiling: true,
      offerProjectTracking: true,
    });
    const unticked = applyComplexitySelection(
      independent,
      selectionWith({ inventory_cogs: { checked: true } }),
    );
    expect(unticked.offerSalesTaxFiling).toBe(true);
    expect(unticked.offerProjectTracking).toBe(true);
    // Unticking after an auto-on also leaves the add-on on; the add-on
    // toggle is the single off-switch.
    const autoOn = applyComplexitySelection(
      assessmentWith({ historicalCleanupPeriods: [] }),
      selectionWith({ sales_tax: { checked: true } }),
    );
    expect(autoOn.offerSalesTaxFiling).toBe(true);
    const reverted = applyComplexitySelection(autoOn, selectionWith({}));
    expect(reverted.offerSalesTaxFiling).toBe(true);
    // Pure helper agrees: checked ticks on, unchecked keeps the flag.
    expect(
      complexityDriverAutoOn(selectionWith({ sales_tax: { checked: true } }), {
        offerSalesTaxFiling: false,
        offerProjectTracking: false,
      }),
    ).toEqual({ offerSalesTaxFiling: true, offerProjectTracking: false });
  });

  it("checklist note agrees with pricing: ticked reads Included, unticked-flag reads Will add", () => {
    // After a live tick the add-on is on, so the checklist reads Included —
    // the same line pricing emits (includedNote).
    const ticked = applyComplexitySelection(
      assessmentWith({ historicalCleanupPeriods: [] }),
      selectionWith({ sales_tax: { checked: true } }),
    );
    const tickedHtml = renderToStaticMarkup(
      createElement(ComplexityChecklist, {
        selection: ticked.complexity,
        existing: complexityExistingPresence(ticked),
        onChange: () => {},
      }),
    );
    expect(tickedHtml).toContain("Included in Sales Tax Filing &amp; Remittance");
    expect(
      getProposalPricingSnapshotData(ticked).packagePricing.maintain.complexity?.lines,
    ).toEqual([expect.objectContaining({ id: "sales_tax", includedNote: expect.any(String) })]);
    // A ticked driver with the line absent (e.g. a stored snapshot from
    // before the auto-on ran) reads "Will add" — the same waiting line
    // pricing emits. Built by spread so load normalization does not flip it.
    const raw: AssessmentState = {
      ...assessmentWith({ historicalCleanupPeriods: [] }),
      offerSalesTaxFiling: false,
      complexity: selectionWith({ sales_tax: { checked: true } }),
    };
    const waitingHtml = renderToStaticMarkup(
      createElement(ComplexityChecklist, {
        selection: raw.complexity,
        existing: { salesTaxAddon: false },
        onChange: () => {},
      }),
    );
    expect(waitingHtml).toContain("Will add the Sales Tax Filing &amp; Remittance add-on.");
  });
});

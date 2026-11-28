import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../who/actions", () => ({
  getOfferBuilderContextAction: async () => null,
  saveOfferDraftAction: async () => undefined,
  syncOfferContactsAction: async () => undefined,
}));

import {
  cleanupPlanSummaryRows,
  getProposalPricingSnapshotData,
  mergeStoredAssessment,
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

const storedPlan = {
  caughtUpThrough: "2026-03",
  startDate: "2026-02-14",
  wrapUpDate: "2026-05-14",
  wrapUpSource: "default",
  paymentPlan: "monthly",
};

describe("spec 04 builder cleanup plan wiring", () => {
  it("reload passes a stored plan through untouched and creates none", () => {
    const base = assessmentWith({});
    expect(base.cleanupPlan).toBeUndefined();
    const withPlan = mergeStoredAssessment(JSON.stringify({ cleanupPlan: storedPlan }), base);
    expect(withPlan.cleanupPlan).toEqual(storedPlan);
    const withoutPlan = mergeStoredAssessment(JSON.stringify({}), base);
    expect(withoutPlan.cleanupPlan).toBeUndefined();
  });

  it("reload drops a non-record plan instead of publishing garbage", () => {
    const base = assessmentWith({});
    expect(mergeStoredAssessment(JSON.stringify({ cleanupPlan: "monthly" }), base).cleanupPlan).toBeUndefined();
    expect(mergeStoredAssessment(JSON.stringify({ cleanupPlan: ["x"] }), base).cleanupPlan).toBeUndefined();
    expect(mergeStoredAssessment(JSON.stringify({ cleanupPlan: null }), base).cleanupPlan).toBeUndefined();
  });

  it("summarizes the plan for the collapsed section", () => {
    expect(cleanupPlanSummaryRows(null)).toEqual([]);
    expect(cleanupPlanSummaryRows(undefined)).toEqual([]);
    expect(cleanupPlanSummaryRows(storedPlan as never)).toEqual([
      ["Caught up through", "March 2026"],
      ["Wrap-up date", "May 14, 2026"],
      ["Cleanup payment", "Monthly installments"],
    ]);
    const overridden = cleanupPlanSummaryRows({ ...storedPlan, wrapUpSource: "override", paymentPlan: "split_50_50" } as never);
    expect(overridden[1]).toEqual(["Wrap-up date (override)", "May 14, 2026"]);
    expect(overridden[2]).toEqual(["Cleanup payment", "50-50"]);
    expect(cleanupPlanSummaryRows({ ...storedPlan, paymentPlan: "weekly" } as never)[2]).toEqual([
      "Cleanup payment",
      "Monthly installments",
    ]);
  });

  it("leaves snapshot pricing untouched when a plan is present", () => {
    const periods = [{ id: "2026", year: 2026, startMonth: 1, endMonth: 3 }];
    const without = getProposalPricingSnapshotData(assessmentWith({ historicalCleanupPeriods: periods }));
    const withPlan = getProposalPricingSnapshotData(
      assessmentWith({ historicalCleanupPeriods: periods, cleanupPlan: storedPlan as never }),
    );
    expect(withPlan.cleanupMonths).toBe(without.cleanupMonths);
    expect(withPlan.packagePricing).toEqual(without.packagePricing);
  });
});

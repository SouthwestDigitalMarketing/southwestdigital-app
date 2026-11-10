import { describe, expect, it, vi } from "vitest";

// The pricing module's import graph reaches the offer server actions; stub that leaf.
vi.mock("../who/actions", () => ({
  getOfferBuilderContextAction: async () => null,
  saveOfferDraftAction: async () => undefined,
  syncOfferContactsAction: async () => undefined,
}));
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GROW_MONTHLY_PREMIUM_OVER_MAINTAIN,
  getProposalPricingSnapshotData,
  type AssessmentState,
} from "./ProposalCreationWorkspaceDemo";
import { buildOptions } from "./OfferProposalPreview";

const FIXTURE_DIR = join(__dirname, "__fixtures__");

function fixture(file: string) {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8"));
}

describe("Grow monthly pricing", () => {
  it("is Maintain plus the flat premium, rounded up to $5", () => {
    const assessment = fixture("01-draft-draft.snapshot.json").assessment as AssessmentState;
    const { packagePricing } = getProposalPricingSnapshotData(assessment);
    expect(packagePricing.maintain.monthly).toBeGreaterThan(0);
    expect(packagePricing.grow.monthly).toBe(
      Math.ceil((packagePricing.maintain.monthly + GROW_MONTHLY_PREMIUM_OVER_MAINTAIN) / 5) * 5,
    );
  });

  it("stays $0 for test proposals", () => {
    const assessment = fixture("04-draft-draft.snapshot.json").assessment as AssessmentState;
    expect(getProposalPricingSnapshotData({ ...assessment, isTestProposal: true }).packagePricing.grow.monthly).toBe(0);
  });

  it("does not change a published proposal: its saved prices win", () => {
    const published = fixture("01-draft-published.snapshot.json");
    const options = buildOptions(published.assessment, published.pricing);
    expect(options.grow.monthlyPrice).toBe(published.pricing.grow.monthly);
    expect(options.maintain.monthlyPrice).toBe(published.pricing.maintain.monthly);
  });
});

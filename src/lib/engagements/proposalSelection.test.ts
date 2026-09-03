import { describe, expect, it } from "vitest";
import { getSelectedProposalTier, isProposalTierId } from "./proposalSelection";

describe("proposal selection state", () => {
  it.each(["grow", "improve", "maintain"])("accepts the %s tier", (tier) => {
    expect(isProposalTierId(tier)).toBe(true);
    expect(getSelectedProposalTier({
      proposalBuilderState: {
        services: { selectedTier: tier, onboardingFee: 0 },
      },
    })).toBe(tier);
  });

  it("does not infer a selection from an onboarding fee", () => {
    expect(getSelectedProposalTier({
      proposalBuilderState: {
        services: { onboardingFee: 500 },
      },
    })).toBeNull();
  });

  it("rejects malformed selection state", () => {
    expect(getSelectedProposalTier(null)).toBeNull();
    expect(getSelectedProposalTier({ proposalBuilderState: [] })).toBeNull();
    expect(getSelectedProposalTier({ proposalBuilderState: { services: { selectedTier: "premium" } } })).toBeNull();
  });
});

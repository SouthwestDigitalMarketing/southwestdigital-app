import { describe, expect, it } from "vitest";
import {
  isProposalPreviewSimulation,
  resolveProposalInteractionEngagementId,
} from "./previewSafety";

describe("proposal preview safety", () => {
  it("treats non-live, embedded, and authorized staff previews as simulations", () => {
    expect(isProposalPreviewSimulation({ live: false })).toBe(true);
    expect(isProposalPreviewSimulation({ embedded: true })).toBe(true);
    expect(isProposalPreviewSimulation({ isStaffPreview: true })).toBe(true);
    expect(isProposalPreviewSimulation({})).toBe(false);
  });

  it("removes engagement access from embedded previews", () => {
    expect(resolveProposalInteractionEngagementId({
      embedded: true,
      engagementId: "engagement-prop",
      searchParamEngagementId: "engagement-query",
    })).toBeNull();
  });

  it("removes engagement access from non-live previews", () => {
    expect(resolveProposalInteractionEngagementId({
      live: false,
      engagementId: "engagement-prop",
      searchParamEngagementId: "engagement-query",
    })).toBeNull();
  });

  it("removes engagement access from staff previews", () => {
    expect(resolveProposalInteractionEngagementId({
      isStaffPreview: true,
      engagementId: "engagement-prop",
      searchParamEngagementId: "engagement-query",
    })).toBeNull();
  });

  it("preserves the normal live proposal engagement lookup", () => {
    expect(resolveProposalInteractionEngagementId({
      engagementId: "engagement-prop",
      searchParamEngagementId: "engagement-query",
    })).toBe("engagement-prop");
    expect(resolveProposalInteractionEngagementId({
      searchParamEngagementId: "engagement-query",
    })).toBe("engagement-query");
  });
});

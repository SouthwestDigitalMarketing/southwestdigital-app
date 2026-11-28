import { describe, expect, it } from "vitest";
import { quoteIsTestProposal, snapshotIsTestProposal } from "./testProposal";

describe("test proposal detection", () => {
  it("reads the snapshot flag", () => {
    expect(snapshotIsTestProposal({ isTestProposal: true })).toBe(true);
    expect(snapshotIsTestProposal({ isTestProposal: false })).toBe(false);
    expect(snapshotIsTestProposal({})).toBe(false);
    expect(snapshotIsTestProposal(null)).toBe(false);
    expect(snapshotIsTestProposal("yes")).toBe(false);
  });
  it("matches either the snapshot or the engagement row", () => {
    expect(quoteIsTestProposal({ snapshotJson: { isTestProposal: true }, engagement: null })).toBe(true);
    expect(
      quoteIsTestProposal({ snapshotJson: {}, engagement: { isTestProposal: true } }),
    ).toBe(true);
    expect(quoteIsTestProposal({ snapshotJson: {}, engagement: null })).toBe(false);
    expect(quoteIsTestProposal({ snapshotJson: {}, engagement: { isTestProposal: false } })).toBe(false);
  });
});

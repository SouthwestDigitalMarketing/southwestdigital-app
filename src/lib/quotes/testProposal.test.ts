import { describe, expect, it } from "vitest";
import {
  quoteIsTestProposal,
  realProposalTake,
  snapshotIsTestProposal,
  testProposalMatchWhere,
} from "./testProposal";

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

describe("testProposalMatchWhere", () => {
  it("counts tests with positive null-safe arms only (snapshot true OR engagement true)", () => {
    // Deliberately no NOT/negation: a comparison against a missing JSON path
    // yields NULL on Postgres and would drop real rows with no snapshot flag.
    expect(testProposalMatchWhere()).toEqual({
      OR: [
        { snapshotJson: { path: ["isTestProposal"], equals: true } },
        { engagement: { isTestProposal: true } },
      ],
    });
  });
});

describe("realProposalTake", () => {
  it("over-fetches by the test count so take still yields 50 real rows", () => {
    expect(realProposalTake(0)).toBe(50);
    expect(realProposalTake(3)).toBe(53);
    expect(realProposalTake(3, 50)).toBe(53);
  });
});

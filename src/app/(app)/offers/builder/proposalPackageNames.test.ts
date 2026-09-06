import { describe, expect, it } from "vitest";
import {
  abbreviateProposalPackageName,
  DEFAULT_PROPOSAL_PACKAGE_NAMES,
  normalizeProposalPackageNames,
  resolveProposalPackageName,
} from "./proposalPackageNames";

describe("proposal package names", () => {
  it("fills missing or blank names with the proposal defaults", () => {
    expect(normalizeProposalPackageNames({ grow: "Premium", improve: "  ", maintain: "Core" })).toEqual({
      grow: "Premium",
      improve: "Improve",
      maintain: "Core",
    });
    expect(normalizeProposalPackageNames(null)).toEqual(DEFAULT_PROPOSAL_PACKAGE_NAMES);
  });

  it("resolves blank draft values safely", () => {
    expect(resolveProposalPackageName({ grow: "  " }, "grow")).toBe("Grow");
    expect(resolveProposalPackageName({ improve: "Accelerate" }, "improve")).toBe("Accelerate");
  });

  it("creates compact selector labels from the current package name", () => {
    expect(abbreviateProposalPackageName("Grow")).toBe("G");
    expect(abbreviateProposalPackageName("Finance Forward")).toBe("FF");
  });
});

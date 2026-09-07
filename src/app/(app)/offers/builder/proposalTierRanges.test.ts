import { describe, expect, it } from "vitest";
import {
  normalizeTierPackageIds,
  packageIdsFromTierRange,
  tierRangeFromPackageIds,
} from "./proposalTierRanges";

describe("proposal tier ranges", () => {
  it("preserves a saved gap instead of silently adding a contracted service", () => {
    expect(normalizeTierPackageIds(["maintain", "grow"])).toEqual([
      "maintain",
      "grow",
    ]);
    expect(tierRangeFromPackageIds(["maintain", "grow"])).toBeNull();
  });

  it("represents a single package as a one-tier range", () => {
    expect(tierRangeFromPackageIds(["improve"])).toEqual({ from: "improve", to: "improve" });
  });

  it("round-trips a range", () => {
    const range = tierRangeFromPackageIds(["grow", "improve"]);
    expect(packageIdsFromTierRange(range)).toEqual(["improve", "grow"]);
  });
});

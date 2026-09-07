import { describe, expect, it } from "vitest";
import {
  normalizeTierPackageIds,
  packageIdsFromTierRange,
  tierRangeFromPackageIds,
} from "./proposalTierRanges";

describe("proposal tier ranges", () => {
  it("fills the missing middle tier in legacy non-contiguous data", () => {
    expect(normalizeTierPackageIds(["maintain", "grow"])).toEqual([
      "maintain",
      "improve",
      "grow",
    ]);
  });

  it("represents a single package as a one-tier range", () => {
    expect(tierRangeFromPackageIds(["improve"])).toEqual({ from: "improve", to: "improve" });
  });

  it("round-trips a range", () => {
    const range = tierRangeFromPackageIds(["grow", "improve"]);
    expect(packageIdsFromTierRange(range)).toEqual(["improve", "grow"]);
  });
});

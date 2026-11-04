import { describe, expect, it } from "vitest";
import { serviceLevelDescription, serviceLevelTitle } from "./serviceLevels";
import { proposalIncludedServices } from "./proposalServices";

describe("service level names", () => {
  it("shows one name per support level everywhere", () => {
    expect(serviceLevelTitle("Standard Client Support")).toBe("Steady Support");
    expect(serviceLevelTitle("Monthly Bookkeeping")).toBe("Monthly Bookkeeping");
  });

  it("uses the same name in the agreement's included services", () => {
    const included = proposalIncludedServices({
      bonuses: [
        { id: "monthly-bookkeeping", name: "Monthly Bookkeeping", description: "", archived: false, defaultPackageIds: ["maintain"] },
        { id: "standard-client-support", name: "Standard Client Support", description: "1-2 days", archived: false, defaultPackageIds: ["maintain"] },
      ],
    }, "maintain");
    expect(included.map((item) => item.name)).toEqual(["Monthly Bookkeeping", "Steady Support"]);
  });
});

describe("serviceLevelDescription", () => {
  it("resolves by catalog name or display title to the current wording", () => {
    expect(serviceLevelDescription("Standard Client Support", "old")).toContain("2–3 business days");
    expect(serviceLevelDescription("Steady Support", "Responses within 1–2 business days")).toContain("2–3 business days");
  });
  it("keeps the stored text for other services", () => {
    expect(serviceLevelDescription("Bookkeeping", "kept")).toBe("kept");
  });
});

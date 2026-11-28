import { describe, expect, it } from "vitest";
import { agreementWhatsIncluded, proposalIncludedServices } from "./proposalServices";
import { supportCopyForPublish } from "./serviceLevels";

const assessment = {
  bonuses: [
    { id: "monthly-bookkeeping", name: "Monthly Bookkeeping", description: "Books done monthly.", defaultPackageIds: ["grow"] },
    { id: "concierge", name: "Concierge Client Support", description: "DB support note.", defaultPackageIds: ["grow"] },
  ],
};

describe("agreementWhatsIncluded", () => {
  it("lists included services with the legacy support meaning by default", () => {
    expect(agreementWhatsIncluded(assessment, "grow")).toEqual([
      { name: "Monthly Bookkeeping", description: "Books done monthly." },
      { name: "White-Glove Concierge", description: "We're on call for you, 24/7, for bookkeeping questions and anything time-sensitive." },
    ]);
  });

  it("carries the new support meaning for new publishes", () => {
    const items = agreementWhatsIncluded(assessment, "grow", supportCopyForPublish());
    expect(items?.[1]).toEqual({
      name: "White-Glove Concierge",
      description: expect.stringContaining("2 business hours"),
    });
  });

  it("returns null when the tier includes nothing", () => {
    expect(agreementWhatsIncluded(assessment, "maintain")).toBeNull();
    expect(agreementWhatsIncluded({}, "grow")).toBeNull();
  });
});

describe("proposalIncludedServices with copy", () => {
  it("resolves support titles from the passed copy and keeps legacy without one", () => {
    const legacy = proposalIncludedServices(assessment, "grow");
    const current = proposalIncludedServices(assessment, "grow", supportCopyForPublish());
    expect(legacy.map((item) => item.name)).toEqual(["Monthly Bookkeeping", "White-Glove Concierge"]);
    expect(current.map((item) => item.name)).toEqual(["Monthly Bookkeeping", "White-Glove Concierge"]);
    // Titles are the same across copies; the frozen meaning is what differs.
    expect(current[1].description).toBe("DB support note.");
  });
});

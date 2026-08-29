import { describe, expect, it } from "vitest";
import { extraIsAvailableForBookSet, extraIsRealEstateSpecific, tagMarksRealEstate } from "./catalog";

describe("real-estate catalog markers", () => {
  it("recognizes the Real estate service tag", () => {
    expect(tagMarksRealEstate({ key: "industry", label: "Real estate service" })).toBe(true);
  });

  it("matches an option or extra to its tagged catalog service", () => {
    expect(
      extraIsRealEstateSpecific(
        { id: "option-1", name: "Property reporting" },
        [{ id: "service-1", code: "option-1", name: "Property reporting", realEstateSpecific: true }],
      ),
    ).toBe(true);
  });

  it("hides tagged options and extras for a non-RE business", () => {
    const extra = { id: "option-1", name: "Property reporting" };
    const catalog = [
      { id: "service-1", code: "option-1", name: "Property reporting", realEstateSpecific: true },
    ];

    expect(extraIsAvailableForBookSet(extra, catalog, "other-business")).toBe(false);
    expect(extraIsAvailableForBookSet(extra, catalog, "real-estate-only")).toBe(true);
  });

  it("keeps untagged options and extras for a non-RE business", () => {
    expect(
      extraIsAvailableForBookSet(
        { id: "option-2", name: "Sales tax filing" },
        [{ id: "service-2", code: "option-2", name: "Sales tax filing", realEstateSpecific: false }],
        "other-business",
      ),
    ).toBe(true);
  });
});

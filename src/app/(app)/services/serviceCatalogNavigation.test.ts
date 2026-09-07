import { describe, expect, it } from "vitest";
import { safeOfferOptionsReturnPath } from "./serviceCatalogNavigation";

describe("service catalog return navigation", () => {
  it("allows only the offer options route", () => {
    expect(safeOfferOptionsReturnPath("/offers/add-ons?offer=quote-1")).toBe(
      "/offers/add-ons?offer=quote-1",
    );
    expect(safeOfferOptionsReturnPath("/offers/add-ons")).toBe("/offers/add-ons");
  });

  it("rejects external and lookalike return paths", () => {
    expect(safeOfferOptionsReturnPath("https://example.com")).toBeNull();
    expect(safeOfferOptionsReturnPath("//example.com/offers/add-ons")).toBeNull();
    expect(safeOfferOptionsReturnPath("/offers/add-ons-malicious")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { campaignsForBrand, mapLink } from "./campaigns";

describe("campaignsForBrand", () => {
  it("lists Bentwater as a draft for Bookkeeping Conroe", () => {
    const [bentwater] = campaignsForBrand("bookkeeping-conroe");
    expect(bentwater.name).toBe("Bentwater");
    expect(bentwater.status).toBe("draft");
    expect(bentwater.pins.every((pin) => pin.radiusMiles >= 1)).toBe(true);
  });

  it("returns nothing for a brand without ads", () => {
    expect(campaignsForBrand("southwest-digital")).toEqual([]);
  });
});

describe("mapLink", () => {
  it("points OpenStreetMap at the pin", () => {
    expect(mapLink({ label: "x", latitude: 30.424, longitude: -95.62, radiusMiles: 1 })).toBe(
      "https://www.openstreetmap.org/?mlat=30.424&mlon=-95.62#map=14/30.424/-95.62",
    );
  });
});

import { describe, expect, it } from "vitest";
import { brandEnvKey, isBookkeepingConroe, legacyBrandSlug } from "./slugs";

describe("brand slugs after the 2026-10-19 rename", () => {
  it("maps the new slugs to the old ones and leaves every other slug alone", () => {
    expect(legacyBrandSlug("bookkeeping-conroe")).toBe("bc");
    expect(legacyBrandSlug("real-estate-bookkeeper")).toBe("treb");
    expect(legacyBrandSlug("bc")).toBe("bc");
    expect(legacyBrandSlug("contigo-accounting")).toBe("contigo-accounting");
  });
  it("builds the same environment variable key before and after the rename", () => {
    expect(brandEnvKey("bc")).toBe("BC");
    expect(brandEnvKey("bookkeeping-conroe")).toBe("BC");
    expect(brandEnvKey("treb")).toBe("TREB");
    expect(brandEnvKey("real-estate-bookkeeper")).toBe("TREB");
    expect(brandEnvKey("contigo-accounting")).toBe("CONTIGO_ACCOUNTING");
    expect(brandEnvKey("southwest-digital-marketing")).toBe("SOUTHWEST_DIGITAL_MARKETING");
  });
  it("recognises Bookkeeping Conroe under either slug, and only it", () => {
    expect(isBookkeepingConroe("bc")).toBe(true);
    expect(isBookkeepingConroe("bookkeeping-conroe")).toBe(true);
    expect(isBookkeepingConroe("treb")).toBe(false);
    expect(isBookkeepingConroe("real-estate-bookkeeper")).toBe(false);
  });
});

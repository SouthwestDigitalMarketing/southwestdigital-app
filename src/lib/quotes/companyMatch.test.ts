import { describe, expect, it } from "vitest";
import { compareCompanyNames, normalizeCompanyName } from "./companyMatch";

describe("normalizeCompanyName", () => {
  it("trims, lowercases, and collapses inner whitespace", () => {
    expect(normalizeCompanyName("  BBQ   Grill  People ")).toBe("bbq grill people");
  });

  it("ignores punctuation", () => {
    expect(normalizeCompanyName("Mike's BBQ, Inc.")).toBe("mikes bbq");
  });

  it("reads & as and and strips the LLC suffix", () => {
    expect(normalizeCompanyName("Smith & Sons LLC")).toBe("smith and sons");
  });

  it("strips each listed corporate suffix", () => {
    for (const suffix of ["LLC", "Inc", "Co", "Corp", "Ltd", "PLLC"]) {
      expect(normalizeCompanyName(`Acme ${suffix}`)).toBe("acme");
    }
  });

  it("only strips trailing suffixes", () => {
    expect(normalizeCompanyName("Core Labs")).toBe("core labs");
  });

  it("keeps a name that is only a suffix", () => {
    expect(normalizeCompanyName("Co")).toBe("co");
  });

  it("collapses dotted suffixes before stripping them", () => {
    expect(normalizeCompanyName("Acme L.L.C.")).toBe("acme");
    expect(normalizeCompanyName("Acme LLC")).toBe("acme");
    expect(normalizeCompanyName("U.S.A. Corp")).toBe("usa");
  });

  it("keeps a period followed by a space as a word split", () => {
    expect(normalizeCompanyName("St. Louis Bread Co.")).toBe("st louis bread");
  });
});

describe("compareCompanyNames", () => {
  it("flags a linked contact under a different company than the proposal", () => {
    // BBQ-like case: the contact belongs to one business, the proposal names another.
    expect(compareCompanyNames("Mike's BBQ Shack", "Arnett Holdings")).toBe("mismatch");
  });

  it("matches Smith & Sons LLC against smith and sons (& reads as and)", () => {
    expect(compareCompanyNames("Smith & Sons LLC", "smith and sons")).toBe("match");
  });

  it("matches across case, spacing, punctuation, and suffixes", () => {
    expect(compareCompanyNames("  BBQ Grill People, Inc.", "bbq grill people")).toBe("match");
  });

  it("matches a dotted suffix against its plain form", () => {
    expect(compareCompanyNames("Acme L.L.C.", "Acme LLC")).toBe("match");
    expect(compareCompanyNames("Acme L.L.C.", "Acme")).toBe("match");
  });

  it("returns unknown when either side is empty", () => {
    expect(compareCompanyNames(null, "Acme")).toBe("unknown");
    expect(compareCompanyNames("Acme", "")).toBe("unknown");
    expect(compareCompanyNames("Acme", "   ")).toBe("unknown");
    expect(compareCompanyNames(undefined, undefined)).toBe("unknown");
  });
});

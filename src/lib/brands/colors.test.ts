import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  darkBrandToneForWhiteText,
  mixBrandColors,
  readableForegroundColor,
  textContrastRating,
} from "./colors";

describe("contrastRatio", () => {
  it("calculates WCAG contrast ratios", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 2);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 2);
  });

  it("returns null for an invalid color", () => {
    expect(contrastRatio("transparent", "#ffffff")).toBeNull();
  });
});

describe("textContrastRating", () => {
  it("rates ordinary text using WCAG AA and AAA thresholds", () => {
    expect(textContrastRating("#ffffff", "#000000")).toBe("AAA");
    expect(textContrastRating("#ffffff", "#767676")).toBe("AA");
    expect(textContrastRating("#ffffff", "#777777")).toBe("Fail");
  });
});

describe("brand-derived accessible tones", () => {
  it("mixes a brand color toward another tone", () => {
    expect(mixBrandColors("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("preserves a compliant dark color", () => {
    expect(darkBrandToneForWhiteText("#17324d")).toBe("#17324d");
  });

  it("darkens a bright selected color only enough to reach AAA", () => {
    const tone = darkBrandToneForWhiteText("#d79b3b");
    expect(tone).not.toBe("#d79b3b");
    expect(tone).not.toBe("#000000");
    expect(contrastRatio("#ffffff", tone)).toBeGreaterThanOrEqual(7);
  });
});

describe("readableForegroundColor", () => {
  it("uses white copy on dark brand colors", () => {
    expect(readableForegroundColor("#17324d")).toBe("#ffffff");
    expect(readableForegroundColor("#111111")).toBe("#ffffff");
  });

  it("uses dark copy on light accent colors", () => {
    expect(readableForegroundColor("#d79b3b")).toBe("#111827");
    expect(readableForegroundColor("rgb(255, 255, 255)")).toBe("#111827");
  });
});

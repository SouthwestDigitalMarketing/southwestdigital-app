import { describe, expect, it } from "vitest";
import { contrastRatio } from "./colors";
import { brandSwipePalette, NEUTRAL_SWIPE_PALETTE } from "./swipePalette";

describe("brand swipe palette", () => {
  it("uses saved brand colors while making light and dark headings readable", () => {
    const palette = brandSwipePalette({ lightColor: "#e1eab3", darkColor: "#112938", accentColor: "#c9922a" });
    expect(palette).not.toEqual(NEUTRAL_SWIPE_PALETTE);
    expect(contrastRatio(palette.lightInk, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.darkInk, "#111827")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.lightTabText, palette.lightTab)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.darkTabText, palette.darkTab)).toBeGreaterThanOrEqual(4.5);
  });

  it("uses a neutral palette for Combined", () => {
    expect(brandSwipePalette(null)).toEqual(NEUTRAL_SWIPE_PALETTE);
  });
});

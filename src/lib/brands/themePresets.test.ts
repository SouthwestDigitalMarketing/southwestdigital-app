import { describe, expect, it } from "vitest";
import { findThemePreset, normalizeThemeChoice, resolveEffectiveThemeColors } from "./themePresets";

describe("theme presets", () => {
  it("exposes Grok as one preset and aliases the old light id", () => {
    expect(findThemePreset("grok-light")).toBeNull();
    expect(normalizeThemeChoice("grok-light")).toBe("grok");
  });

  it("allows the selected mode to control Grok", () => {
    expect(resolveEffectiveThemeColors({ themePreset: "grok", mode: "light" }).mode).toBe("light");
    expect(resolveEffectiveThemeColors({ themePreset: "grok", mode: "dark" }).mode).toBe("dark");
  });
});

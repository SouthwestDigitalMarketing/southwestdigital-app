import { describe, expect, it } from "vitest";
import { contrastRatio } from "./colors";
import {
  appCanvasGradient,
  appPrimaryActionCssVariables,
  appThemeCssVariables,
  primaryActionCssVariables,
} from "./themeTokens";

describe("semantic theme tokens", () => {
  it("builds a subtle bottom-right-to-top-left canvas gradient from all three theme colors", () => {
    const light = appCanvasGradient("light");
    const dark = appCanvasGradient("dark");

    expect(light).toContain("linear-gradient(to top left");
    expect(light).toContain("var(--brand-light)");
    expect(light).toContain("var(--brand-dark)");
    expect(light).toContain("var(--brand-accent)");
    expect(dark).not.toBe(light);
  });

  it("uses the accent as the primary action background with readable foreground", () => {
    expect(appPrimaryActionCssVariables({ accent: "#8a5a12" })).toEqual({
      "--action-primary-background": "#8a5a12",
      "--action-primary-foreground": "#ffffff",
    });
    expect(appPrimaryActionCssVariables({ accent: "#d79b3b" })).toEqual({
      "--action-primary-background": "#d79b3b",
      "--action-primary-foreground": "#111827",
    });
  });

  it("creates the same pair for proposal actions", () => {
    expect(primaryActionCssVariables("#2563eb")).toEqual({
      "--action-primary-background": "#2563eb",
      "--action-primary-foreground": "#ffffff",
    });
  });

  it("allows brand settings to choose the accent button foreground", () => {
    expect(primaryActionCssVariables("#d79b3b", "#111827")).toEqual({
      "--action-primary-background": "#d79b3b",
      "--action-primary-foreground": "#111827",
    });
  });

  it("derives overlay surfaces from the selected dark brand color", () => {
    const light = appThemeCssVariables({
      mode: "light",
      accent: "#d79b3b",
      dark: "#17324d",
    });
    const dark = appThemeCssVariables({
      mode: "dark",
      accent: "#d79b3b",
      dark: "#17324d",
    });

    expect(light["--surface-overlay"]).toBe("#17324d");
    expect(dark["--surface-overlay"]).not.toBe(light["--surface-overlay"]);
    expect(contrastRatio(light["--text-on-overlay"], light["--surface-overlay"])).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(dark["--text-on-overlay"], dark["--surface-overlay"])).toBeGreaterThanOrEqual(7);
  });

  it("uses an accessible shade when the selected dark color is too bright", () => {
    const variables = appThemeCssVariables({
      mode: "light",
      accent: "#d79b3b",
      dark: "#d79b3b",
    });

    expect(variables["--surface-overlay"]).not.toBe("#000000");
    expect(contrastRatio("#ffffff", variables["--surface-overlay"])).toBeGreaterThanOrEqual(7);
  });
});

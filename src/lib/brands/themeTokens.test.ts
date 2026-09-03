import { describe, expect, it } from "vitest";
import { contrastRatio, mixBrandColors } from "./colors";
import {
  appCanvasGradient,
  appPrimaryActionCssVariables,
  appThemeCssVariables,
  chartPaletteCssVariables,
  primaryActionCssVariables,
} from "./themeTokens";

describe("semantic theme tokens", () => {
  it("builds a subtle bottom-right-to-top-left canvas gradient from all three theme colors", () => {
    const light = appCanvasGradient("light");
    const dark = appCanvasGradient("dark");

    expect(light).toContain("linear-gradient(to top left");
    expect(light).toContain("var(--theme-light)");
    expect(light).toContain("var(--theme-dark)");
    expect(light).toContain("var(--theme-accent)");
    expect(light).toContain("var(--main-panel-canvas)");
    expect(dark).toContain("var(--main-panel-canvas)");
    expect(dark).not.toBe(light);
  });

  it("uses the theme dark color for app primary actions on light surfaces", () => {
    expect(appPrimaryActionCssVariables({ mode: "light", dark: "#17324d" })).toEqual({
      "--action-primary-background": "#17324d",
      "--action-primary-foreground": "#ffffff",
      "--action-primary-border": "#17324d",
    });
  });

  it("lifts the theme dark color for visible app primary actions in dark mode", () => {
    expect(appThemeCssVariables({ mode: "dark", dark: "#0a0a0a" })).toMatchObject({
      "--action-primary-background": "#606060",
      "--action-primary-foreground": "#ffffff",
      "--action-primary-border": "#606060",
    });
  });

  it("keeps dark-mode primary actions distinct from cards and their labels readable", () => {
    const darkColors = [
      "#1b263b",
      "#0a1730",
      "#10233a",
      "#0a0a0b",
      "#0f172a",
      "#071a0f",
      "#0a0a0a",
    ];

    for (const dark of darkColors) {
      const variables = appPrimaryActionCssVariables({ mode: "dark", dark });
      const cardSurface = mixBrandColors(dark, "#0d0d0d", 0.28);

      expect(contrastRatio(variables["--action-primary-background"], cardSurface) ?? 0)
        .toBeGreaterThanOrEqual(3);
      expect(contrastRatio(
        variables["--action-primary-foreground"],
        variables["--action-primary-background"],
      ) ?? 0).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps every theme-derived chart tone distinguishable from its card surface", () => {
    const themes = [
      { dark: "#1b263b", accent: "#d79b3b" },
      { dark: "#0a1730", accent: "#64748b" },
      { dark: "#10233a", accent: "#c9922a" },
      { dark: "#0a0a0b", accent: "#d97706" },
      { dark: "#0f172a", accent: "#2563eb" },
      { dark: "#071a0f", accent: "#c9a84c" },
      { dark: "#0a0a0a", accent: "#ffffff" },
    ];
    const contrastTokens = [
      "--chart-stage-2",
      "--chart-stage-3",
      "--chart-stage-4",
      "--chart-stage-5",
      "--chart-stage-6",
      "--chart-stage-7",
      "--chart-stage-8",
      "--chart-stage-9",
      "--chart-stage-10",
      "--chart-series-2",
      "--chart-series-3",
      "--chart-series-4",
      "--chart-other",
      "--chart-muted",
    ] as const;

    for (const theme of themes) {
      for (const mode of ["light", "dark"] as const) {
        const variables = chartPaletteCssVariables({ mode, ...theme });
        const cardSurface = mode === "dark"
          ? mixBrandColors(theme.dark, "#0d0d0d", 0.28)
          : "#ffffff";

        for (const token of contrastTokens) {
          expect(contrastRatio(variables[token], cardSurface) ?? 0, `${token} ${mode} ${theme.dark}/${theme.accent}`)
            .toBeGreaterThanOrEqual(3);
        }

        expect(variables["--chart-stage-1"], `${mode} ${theme.dark}/${theme.accent}`).toBe(theme.dark);
        expect(variables["--chart-stage-11"], `${mode} ${theme.dark}/${theme.accent}`).toBe(theme.accent);

        expect(new Set([
          variables["--chart-stage-1"],
          variables["--chart-stage-2"],
          variables["--chart-stage-3"],
          variables["--chart-stage-4"],
          variables["--chart-stage-5"],
          variables["--chart-stage-6"],
          variables["--chart-stage-7"],
          variables["--chart-stage-8"],
          variables["--chart-stage-9"],
          variables["--chart-stage-10"],
          variables["--chart-stage-11"],
        ]).size, `${mode} ${theme.dark}/${theme.accent}`).toBe(11);
      }
    }
  });

  it("creates the same pair for proposal actions", () => {
    expect(primaryActionCssVariables("#2563eb")).toEqual({
      "--action-primary-background": "#2563eb",
      "--action-primary-foreground": "#ffffff",
      "--action-primary-border": "#92b1f5",
    });
  });

  it("allows brand settings to choose the accent button foreground", () => {
    expect(primaryActionCssVariables("#d79b3b", "#111827")).toEqual({
      "--action-primary-background": "#d79b3b",
      "--action-primary-foreground": "#111827",
      "--action-primary-border": "#745a31",
    });
  });

  it("passes the mode-aware dark primary through the app theme", () => {
    expect(appThemeCssVariables({
      mode: "light",
      dark: "#0a0a0a",
    })).toMatchObject({
      "--action-primary-background": "#0a0a0a",
      "--action-primary-foreground": "#ffffff",
      "--action-primary-border": "#0a0a0a",
    });
  });

  it("derives overlay surfaces from the selected dark brand color", () => {
    const light = appThemeCssVariables({
      mode: "light",
      dark: "#17324d",
    });
    const dark = appThemeCssVariables({
      mode: "dark",
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
      dark: "#d79b3b",
    });

    expect(variables["--surface-overlay"]).not.toBe("#000000");
    expect(contrastRatio("#ffffff", variables["--surface-overlay"])).toBeGreaterThanOrEqual(7);
  });
});

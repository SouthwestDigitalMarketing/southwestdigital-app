import {
  darkBrandToneForWhiteText,
  mixBrandColors,
  readableForegroundColor,
} from "./colors";

export type ThemeMode = "light" | "dark" | "system";

export type PrimaryActionCssVariables = {
  "--action-primary-background": string;
  "--action-primary-foreground": string;
};

export type OverlaySurfaceCssVariables = {
  "--surface-overlay": string;
  "--text-on-overlay": string;
  "--border-on-overlay": string;
};

export type AppThemeCssVariables = PrimaryActionCssVariables & OverlaySurfaceCssVariables;

export function appCanvasGradient(mode: Exclude<ThemeMode, "system">) {
  const accentWeight = mode === "dark" ? 2 : 1;
  const lightWeight = mode === "dark" ? 1.5 : 0.75;
  const darkWeight = mode === "dark" ? 1 : 0.5;

  return `linear-gradient(to top left, color-mix(in srgb, var(--brand-accent) ${accentWeight}%, var(--app-canvas)) 0%, color-mix(in srgb, var(--brand-light) ${lightWeight}%, var(--app-canvas)) 52%, color-mix(in srgb, var(--brand-dark) ${darkWeight}%, var(--app-canvas)) 100%)`;
}

export function primaryActionCssVariables(background: string, foreground?: string): PrimaryActionCssVariables {
  return {
    "--action-primary-background": background,
    "--action-primary-foreground": foreground ?? readableForegroundColor(background),
  };
}

export function appPrimaryActionCssVariables({
  accent,
}: {
  accent: string;
}): PrimaryActionCssVariables {
  return primaryActionCssVariables(accent);
}

export function overlaySurfaceCssVariables({
  mode,
  dark,
}: {
  mode: ThemeMode;
  dark: string;
}): OverlaySurfaceCssVariables {
  const modeAdjustedDark = mode === "dark"
    ? mixBrandColors(dark, "#ffffff", 0.08)
    : dark;
  const overlay = darkBrandToneForWhiteText(modeAdjustedDark);

  return {
    "--surface-overlay": overlay,
    "--text-on-overlay": "#ffffff",
    "--border-on-overlay": mixBrandColors(overlay, "#ffffff", mode === "dark" ? 0.28 : 0.18),
  };
}

export function appThemeCssVariables({
  mode,
  accent,
  dark,
}: {
  mode: ThemeMode;
  accent: string;
  dark: string;
}): AppThemeCssVariables {
  return {
    ...appPrimaryActionCssVariables({ accent }),
    ...overlaySurfaceCssVariables({ mode, dark }),
  };
}

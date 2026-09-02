import {
  contrastRatio,
  darkBrandToneForWhiteText,
  mixBrandColors,
  readableForegroundColor,
} from "./colors";

export type ThemeMode = "light" | "dark" | "system";

export type PrimaryActionCssVariables = {
  "--action-primary-background": string;
  "--action-primary-foreground": string;
  "--action-primary-border": string;
};

export type OverlaySurfaceCssVariables = {
  "--surface-overlay": string;
  "--text-on-overlay": string;
  "--border-on-overlay": string;
};

export type ChartPaletteCssVariables = {
  "--chart-stage-1": string;
  "--chart-stage-2": string;
  "--chart-stage-3": string;
  "--chart-stage-4": string;
  "--chart-stage-5": string;
  "--chart-stage-6": string;
  "--chart-stage-7": string;
  "--chart-stage-8": string;
  "--chart-stage-9": string;
  "--chart-stage-10": string;
  "--chart-stage-11": string;
  "--chart-series-1": string;
  "--chart-series-2": string;
  "--chart-series-3": string;
  "--chart-series-4": string;
  "--chart-series-5": string;
  "--chart-other": string;
  "--chart-primary": string;
  "--chart-muted": string;
  "--chart-cursor": string;
};

export type AppThemeCssVariables = PrimaryActionCssVariables & OverlaySurfaceCssVariables;

const DARK_MODE_PRIMARY_LIFT = 0.35;
const CHART_MINIMUM_CONTRAST = 3;

function ensureChartContrast(
  color: string,
  surface: string,
  mode: Exclude<ThemeMode, "system">,
  variation = 0,
) {
  if ((contrastRatio(color, surface) ?? 0) >= CHART_MINIMUM_CONTRAST) return color;

  const contrastTarget = mode === "dark" ? "#ffffff" : "#000000";
  let insufficientAmount = 0;
  let sufficientAmount = 1;

  for (let step = 0; step < 20; step += 1) {
    const amount = (insufficientAmount + sufficientAmount) / 2;
    const candidate = mixBrandColors(color, contrastTarget, amount);
    if ((contrastRatio(candidate, surface) ?? 0) >= CHART_MINIMUM_CONTRAST) {
      sufficientAmount = amount;
    } else {
      insufficientAmount = amount;
    }
  }

  const separationAmount = Math.max(0, variation - 0.55) * 0.55;
  return mixBrandColors(
    color,
    contrastTarget,
    Math.min(1, sufficientAmount + separationAmount),
  );
}

export function appCanvasGradient(mode: Exclude<ThemeMode, "system">) {
  const accentWeight = mode === "dark" ? 2 : 1;
  const lightWeight = mode === "dark" ? 1.5 : 0.75;
  const darkWeight = mode === "dark" ? 1 : 0.5;

  return `linear-gradient(to top left, color-mix(in srgb, var(--brand-accent) ${accentWeight}%, var(--main-panel-canvas)) 0%, color-mix(in srgb, var(--brand-light) ${lightWeight}%, var(--main-panel-canvas)) 52%, color-mix(in srgb, var(--brand-dark) ${darkWeight}%, var(--main-panel-canvas)) 100%)`;
}

export function chartPaletteCssVariables({
  mode,
  dark,
  accent,
}: {
  mode: Exclude<ThemeMode, "system">;
  dark: string;
  accent: string;
}): ChartPaletteCssVariables {
  const cardSurface = mode === "dark"
    ? mixBrandColors(dark, "#0d0d0d", 0.28)
    : "#ffffff";
  const primary = appPrimaryActionCssVariables({ mode, dark })["--action-primary-background"];
  const stageBase = dark;
  const stageTarget = accent;
  const stageAt = (accentWeight: number) => {
    const color = mixBrandColors(stageBase, stageTarget, accentWeight);
    if (accentWeight === 0 || accentWeight === 1) return color;
    return ensureChartContrast(color, cardSurface, mode, accentWeight);
  };
  const usedStageColors = new Set<string>();
  const uniqueStageAt = (accentWeight: number) => {
    let color = stageAt(accentWeight);
    const contrastTarget = mode === "dark" ? "#ffffff" : "#000000";
    let separationAmount = 0.025;

    while (usedStageColors.has(color) && separationAmount <= 1) {
      color = ensureChartContrast(
        mixBrandColors(color, contrastTarget, separationAmount),
        cardSurface,
        mode,
      );
      separationAmount += 0.025;
    }

    usedStageColors.add(color);
    return color;
  };
  const stages = [
    uniqueStageAt(0),
    uniqueStageAt(0.1),
    uniqueStageAt(0.2),
    uniqueStageAt(0.3),
    uniqueStageAt(0.4),
    uniqueStageAt(0.5),
    uniqueStageAt(0.6),
    uniqueStageAt(0.7),
    uniqueStageAt(0.8),
    uniqueStageAt(0.9),
    uniqueStageAt(1),
  ] as const;
  const muted = ensureChartContrast(
    mixBrandColors(primary, cardSurface, 0.48),
    cardSurface,
    mode,
  );
  const other = ensureChartContrast(
    mixBrandColors(primary, cardSurface, 0.68),
    cardSurface,
    mode,
  );

  return {
    "--chart-stage-1": stages[0],
    "--chart-stage-2": stages[1],
    "--chart-stage-3": stages[2],
    "--chart-stage-4": stages[3],
    "--chart-stage-5": stages[4],
    "--chart-stage-6": stages[5],
    "--chart-stage-7": stages[6],
    "--chart-stage-8": stages[7],
    "--chart-stage-9": stages[8],
    "--chart-stage-10": stages[9],
    "--chart-stage-11": stages[10],
    "--chart-series-1": stages[0],
    "--chart-series-2": stages[2],
    "--chart-series-3": stages[5],
    "--chart-series-4": stages[8],
    "--chart-series-5": stages[10],
    "--chart-other": other,
    "--chart-primary": stages[0],
    "--chart-muted": muted,
    "--chart-cursor": `color-mix(in srgb, ${stages[0]} 10%, transparent)`,
  };
}

export function primaryActionCssVariables(background: string, foreground?: string): PrimaryActionCssVariables {
  const resolvedForeground = foreground ?? readableForegroundColor(background);
  const borderTone = readableForegroundColor(background);

  return {
    "--action-primary-background": background,
    "--action-primary-foreground": resolvedForeground,
    "--action-primary-border": mixBrandColors(background, borderTone, 0.5),
  };
}

export function appPrimaryActionCssVariables({
  mode,
  dark,
}: {
  mode: ThemeMode;
  dark: string;
}): PrimaryActionCssVariables {
  const background = mode === "dark"
    ? mixBrandColors(dark, "#ffffff", DARK_MODE_PRIMARY_LIFT)
    : dark;
  const variables = primaryActionCssVariables(background);

  return {
    ...variables,
    "--action-primary-border": background,
  };
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
  dark,
}: {
  mode: ThemeMode;
  dark: string;
}): AppThemeCssVariables {
  return {
    ...appPrimaryActionCssVariables({ mode, dark }),
    ...overlaySurfaceCssVariables({ mode, dark }),
  };
}

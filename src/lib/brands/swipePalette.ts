import { contrastRatio, mixBrandColors, normalizeBrandColor, readableForegroundColor } from "./colors";
import { resolveEffectiveThemeColors } from "./themePresets";

export type SwipePalette = {
  lightInk: string;
  darkInk: string;
  lightAccent: string;
  darkAccent: string;
  lightTab: string;
  darkTab: string;
  lightTabText: string;
  darkTabText: string;
};

function withContrast(color: string, background: string, minimum: number): string {
  const normalized = normalizeBrandColor(color) ?? "#64748b";
  if ((contrastRatio(normalized, background) ?? 0) >= minimum) return normalized;
  const target = background === "#ffffff" ? "#000000" : "#ffffff";
  let low = 0;
  let high = 1;
  for (let i = 0; i < 20; i += 1) {
    const middle = (low + high) / 2;
    if ((contrastRatio(mixBrandColors(normalized, target, middle), background) ?? 0) >= minimum) high = middle;
    else low = middle;
  }
  return mixBrandColors(normalized, target, high);
}

export const NEUTRAL_SWIPE_PALETTE: SwipePalette = {
  lightInk: "#334155", darkInk: "#cbd5e1",
  lightAccent: "#64748b", darkAccent: "#94a3b8",
  lightTab: "#334155", darkTab: "#334155",
  lightTabText: "#ffffff", darkTabText: "#ffffff",
};

export function brandSwipePalette(theme: {
  themePreset?: string | null;
  lightColor?: string | null;
  darkColor?: string | null;
  accentColor?: string | null;
} | null | undefined): SwipePalette {
  if (!theme) return NEUTRAL_SWIPE_PALETTE;
  const colors = resolveEffectiveThemeColors(theme);
  const lightInk = withContrast(colors.lightColor, "#ffffff", 4.5);
  const darkInk = withContrast(colors.accentColor, "#111827", 4.5);
  const lightAccent = withContrast(colors.accentColor, "#ffffff", 3);
  const darkAccent = withContrast(colors.accentColor, "#111827", 3);
  const lightTab = lightInk;
  const darkTab = withContrast(colors.darkColor, "#111827", 3);
  return {
    lightInk, darkInk, lightAccent, darkAccent, lightTab, darkTab,
    lightTabText: readableForegroundColor(lightTab),
    darkTabText: readableForegroundColor(darkTab),
  };
}

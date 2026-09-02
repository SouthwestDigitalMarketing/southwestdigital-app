export const BRAND_COLORS_CHOICE = "brand-colors" as const;

export type ThemePreset = {
  id: "jp-morgan" | "classic" | "executive" | "modern" | "prestige" | "grok";
  name: string;
  lightColor: string;
  darkColor: string;
  accentColor: string;
  mode: "light" | "dark";
};

export type ThemeChoice = typeof BRAND_COLORS_CHOICE | ThemePreset["id"];

export const THEME_PRESETS: ReadonlyArray<ThemePreset> = [
  {
    id: "jp-morgan",
    name: "JP Morgan",
    lightColor: "#14243d",
    darkColor: "#0a1730",
    accentColor: "#64748b",
    mode: "light",
  },
  {
    id: "classic",
    name: "Classic",
    lightColor: "#1b3a5c",
    darkColor: "#10233a",
    accentColor: "#c9922a",
    mode: "light",
  },
  {
    id: "executive",
    name: "Executive",
    lightColor: "#1c1c1e",
    darkColor: "#0a0a0b",
    accentColor: "#d97706",
    mode: "light",
  },
  {
    id: "modern",
    name: "Modern",
    lightColor: "#1e293b",
    darkColor: "#0f172a",
    accentColor: "#2563eb",
    mode: "light",
  },
  {
    id: "prestige",
    name: "Prestige",
    lightColor: "#0f2d1a",
    darkColor: "#071a0f",
    accentColor: "#c9a84c",
    mode: "light",
  },
  {
    id: "grok",
    name: "Grok",
    lightColor: "#000000",
    darkColor: "#0a0a0a",
    accentColor: "#ffffff",
    mode: "dark",
  },
];

const PRESET_IDS = new Set<ThemeChoice>([
  BRAND_COLORS_CHOICE,
  ...THEME_PRESETS.map((preset) => preset.id),
]);

export function normalizeThemeChoice(value: string | null | undefined): ThemeChoice {
  if (value === "grok-light") return "grok";
  return value && PRESET_IDS.has(value as ThemeChoice) ? (value as ThemeChoice) : BRAND_COLORS_CHOICE;
}

export function findThemePreset(id: string | null | undefined): ThemePreset | null {
  if (!id || id === BRAND_COLORS_CHOICE) return null;
  return THEME_PRESETS.find((preset) => preset.id === id) ?? null;
}

export type EffectiveThemeColors = {
  lightColor: string;
  darkColor: string;
  accentColor: string;
  mode: "light" | "dark";
};

export function resolveEffectiveThemeColors(theme: {
  themePreset?: string | null;
  lightColor?: string | null;
  darkColor?: string | null;
  accentColor?: string | null;
  mode?: string | null;
}): EffectiveThemeColors {
  const preset = findThemePreset(theme.themePreset);
  if (preset) {
    return {
      lightColor: preset.lightColor,
      darkColor: preset.darkColor,
      accentColor: preset.accentColor,
      mode: theme.mode === "dark" || theme.mode === "light" ? theme.mode : preset.mode,
    };
  }
  const light = theme.lightColor ?? "#17324d";
  return {
    lightColor: light,
    darkColor: theme.darkColor ?? light,
    accentColor: theme.accentColor ?? "#d79b3b",
    mode: theme.mode === "dark" ? "dark" : "light",
  };
}

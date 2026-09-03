import {
  contrastRatio,
  darkBrandToneForWhiteText,
  mixBrandColors,
  readableForegroundColor,
} from "@/lib/brands/colors";

export type ProposalThemeId = "brand" | "jp-morgan" | "classic" | "executive" | "modern" | "prestige" | "grok";

export type ProposalMode = "light" | "dark";

export type ProposalTheme = {
  id: ProposalThemeId;
  label: string;
  description: string;
  light: string | null; // null = brand light
  accent: string | null;  // null = brand accent
  pageBg: { light: string; dark: string };
  // Optional per-mode color overrides for themes whose identity inverts (e.g. Grok monochrome).
  darkLight?: string;
  darkAccent?: string;
};

export const PROPOSAL_THEMES: ProposalTheme[] = [
  {
    id: "brand",
    label: "Brand",
    description: "Your brand colors from Settings",
    light: null,
    accent: null,
    pageBg: {
      light: "#ffffff",
      dark: "linear-gradient(180deg,#0f172a 0%,#1e293b 100%)",
    },
  },
  {
    id: "jp-morgan",
    label: "JP Morgan",
    description: "Deep navy with restrained slate — restrained and institutional",
    light: "#14243d",
    accent: "#64748b",
    pageBg: {
      light: "linear-gradient(180deg,#f1f5f9 0%,#ffffff 100%)",
      dark: "linear-gradient(180deg,#0a1730 0%,#14243d 100%)",
    },
  },
  {
    id: "classic",
    label: "Classic",
    description: "Deep navy with warm gold — traditional professional services",
    light: "#1b3a5c",
    accent: "#c9922a",
    pageBg: {
      light: "linear-gradient(180deg,#eef2f7 0%,#ffffff 100%)",
      dark: "linear-gradient(180deg,#0f2137 0%,#1b3a5c 100%)",
    },
  },
  {
    id: "executive",
    label: "Executive",
    description: "Near-black with amber — refined and premium",
    light: "#1c1c1e",
    accent: "#d97706",
    pageBg: {
      light: "linear-gradient(180deg,#f5f5f5 0%,#ffffff 100%)",
      dark: "linear-gradient(180deg,#0a0a0b 0%,#1c1c1e 100%)",
    },
  },
  {
    id: "modern",
    label: "Modern",
    description: "Midnight slate with sapphire — contemporary and sharp",
    light: "#1e293b",
    accent: "#2563eb",
    pageBg: {
      light: "linear-gradient(180deg,#f8fafc 0%,#ffffff 100%)",
      dark: "linear-gradient(180deg,#0f172a 0%,#1e293b 100%)",
    },
  },
  {
    id: "prestige",
    label: "Prestige",
    description: "Bottle green with champagne gold — wealth management aesthetic",
    light: "#0f2d1a",
    accent: "#c9a84c",
    pageBg: {
      light: "linear-gradient(180deg,#f0f7f2 0%,#ffffff 100%)",
      dark: "linear-gradient(180deg,#071a0f 0%,#0f2d1a 100%)",
    },
  },
  {
    id: "grok",
    label: "Grok",
    description: "Pure monochrome — minimalist tech aesthetic",
    light: "#111111",
    accent: "#111111",
    pageBg: {
      light: "#ffffff",
      dark: "#000000",
    },
    darkLight: "#ffffff",
    darkAccent: "#ffffff",
  },
];

export const DEFAULT_PROPOSAL_THEME_ID: ProposalThemeId = "brand";
export const DEFAULT_PROPOSAL_MODE: ProposalMode = "light";

export type ProposalDarkSurfaceColors = {
  surface: string;
  subtle: string;
  control: string;
  rowAlt: string;
};

const MINIMUM_TEXT_CONTRAST = 4.5;

export function getProposalSurfaceTextColor(background: string, preferred: string) {
  if ((contrastRatio(preferred, background) ?? 0) >= MINIMUM_TEXT_CONTRAST) {
    return preferred;
  }

  const readable = readableForegroundColor(background);
  if ((contrastRatio(readable, background) ?? 0) >= MINIMUM_TEXT_CONTRAST) {
    return readable;
  }

  const whiteContrast = contrastRatio("#ffffff", background) ?? 0;
  const blackContrast = contrastRatio("#000000", background) ?? 0;
  return whiteContrast >= blackContrast ? "#ffffff" : "#000000";
}

export function getProposalInkColor(
  mode: ProposalMode,
  brandDark: string,
  themeId: ProposalThemeId = "brand",
) {
  if (mode === "light") {
    return getProposalSurfaceTextColor("#ffffff", brandDark);
  }

  const darkSurface = getProposalDarkSurfaceColors(themeId, brandDark).surface;
  const preferred = mixBrandColors(brandDark, "#ffffff", 0.8);
  return getProposalSurfaceTextColor(darkSurface, preferred);
}

export function getProposalDarkSurfaceColors(
  themeId: ProposalThemeId,
  brandDark: string,
): ProposalDarkSurfaceColors {
  if (themeId === "grok") {
    // Grok inverts its headings and accents to white in dark mode. Its card
    // surfaces must still derive from near-black rather than that inverted ink.
    const surface = mixBrandColors("#0a0a0a", "#0d0d0d", 0.28);
    return {
      surface,
      subtle: mixBrandColors(surface, "#ffffff", 0.06),
      control: mixBrandColors(surface, "#ffffff", 0.16),
      rowAlt: mixBrandColors(surface, "#ffffff", 0.1),
    };
  }

  const darkBase = darkBrandToneForWhiteText(brandDark);
  return {
    surface: mixBrandColors(darkBase, "#ffffff", 0.18),
    subtle: mixBrandColors(darkBase, "#ffffff", 0.1),
    control: mixBrandColors(darkBase, "#ffffff", 0.28),
    rowAlt: mixBrandColors(darkBase, "#ffffff", 0.14),
  };
}

export type ProposalUrgencySurfaceColors = {
  background: string;
  border: string;
  iconBackground: string;
  ink: string;
};

export function getProposalUrgencySurfaceColors(
  accent: string,
  preferredInk: string,
): ProposalUrgencySurfaceColors {
  const background = mixBrandColors(accent, "#ffffff", 0.9);
  const ink = getProposalSurfaceTextColor(background, preferredInk);

  return {
    background,
    border: mixBrandColors(background, accent, 0.4),
    iconBackground: mixBrandColors(accent, "#ffffff", 0.78),
    ink,
  };
}

export function getProposalSectionHeaderBackground(mode: ProposalMode, brandDark: string) {
  return mode === "dark"
    ? mixBrandColors(brandDark, "#000000", 0.6)
    : mixBrandColors(brandDark, "#ffffff", 0.9);
}

export function getProposalAccentHeaderBackground(mode: ProposalMode, accent: string) {
  return mixBrandColors(accent, mode === "dark" ? "#000000" : "#ffffff", 0.85);
}

export function getProposalTheme(id: string): ProposalTheme {
  return PROPOSAL_THEMES.find((t) => t.id === id) ?? PROPOSAL_THEMES[0];
}

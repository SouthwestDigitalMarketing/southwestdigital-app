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

export function getProposalTheme(id: string): ProposalTheme {
  return PROPOSAL_THEMES.find((t) => t.id === id) ?? PROPOSAL_THEMES[0];
}

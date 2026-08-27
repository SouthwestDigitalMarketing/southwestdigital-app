export type ProposalThemeId = "brand" | "brand-light" | "brand-dark" | "brand-accent" | "classic" | "executive" | "modern" | "prestige";

// Sentinel values for primary/accent: resolved against brand colors at render time.
export const BRAND_PRIMARY_SENTINEL = "__brand-primary__";
export const BRAND_ACCENT_SENTINEL = "__brand-accent__";

export type ProposalTheme = {
  id: ProposalThemeId;
  label: string;
  description: string;
  primary: string | null; // null = brand primary; BRAND_ACCENT_SENTINEL = brand accent
  accent: string | null;  // null = brand accent; BRAND_PRIMARY_SENTINEL = brand primary
  pageBg: string;
  swatchBg?: string; // optional card background in the theme picker swatch
};

export const PROPOSAL_THEMES: ProposalTheme[] = [
  {
    id: "brand",
    label: "Brand",
    description: "Your brand colors on a soft light background",
    primary: null,
    accent: null,
    pageBg: "linear-gradient(180deg,#f7f8fb 0%,#ffffff 100%)",
  },
  {
    id: "brand-light",
    label: "Brand Light",
    description: "Your brand colors on a pure white background",
    primary: null,
    accent: null,
    pageBg: "#ffffff",
    swatchBg: "#ffffff",
  },
  {
    id: "brand-dark",
    label: "Brand Dark",
    description: "Your brand colors on a deeper, richer page tone",
    primary: null,
    accent: null,
    pageBg: "linear-gradient(180deg,#dde3ed 0%,#f0f3f8 100%)",
    swatchBg: "#dde3ed",
  },
  {
    id: "brand-accent",
    label: "Brand Accent",
    description: "Your accent color leads, brand primary as the supporting tone",
    primary: BRAND_ACCENT_SENTINEL,
    accent: BRAND_PRIMARY_SENTINEL,
    pageBg: "linear-gradient(180deg,#f7f8fb 0%,#ffffff 100%)",
  },
  {
    id: "classic",
    label: "Classic",
    description: "Deep navy with warm gold — traditional professional services",
    primary: "#1b3a5c",
    accent: "#c9922a",
    pageBg: "linear-gradient(180deg,#eef2f7 0%,#ffffff 100%)",
  },
  {
    id: "executive",
    label: "Executive",
    description: "Near-black with amber — refined and premium",
    primary: "#1c1c1e",
    accent: "#d97706",
    pageBg: "linear-gradient(180deg,#f5f5f5 0%,#ffffff 100%)",
  },
  {
    id: "modern",
    label: "Modern",
    description: "Midnight slate with sapphire — contemporary and sharp",
    primary: "#1e293b",
    accent: "#2563eb",
    pageBg: "linear-gradient(180deg,#f8fafc 0%,#ffffff 100%)",
  },
  {
    id: "prestige",
    label: "Prestige",
    description: "Bottle green with champagne gold — wealth management aesthetic",
    primary: "#0f2d1a",
    accent: "#c9a84c",
    pageBg: "linear-gradient(180deg,#f0f7f2 0%,#ffffff 100%)",
  },
];

export function getProposalTheme(id: string): ProposalTheme {
  return PROPOSAL_THEMES.find((t) => t.id === id) ?? PROPOSAL_THEMES[0];
}
